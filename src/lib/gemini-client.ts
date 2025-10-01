/**
 * Google Gemini 2.5 Flash クライアント
 * JSON出力 + Thinking対応
 */

import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

type RunGeminiArgs = {
  apiKey?: string;
  model?: string; // "gemini-2.5-flash" 既定
  text: string;
  timeoutMs?: number;
  thinkingBudget?: number; // 例: 0 / 512 / 2048 / -1
  // 構造化出力したいときのスキーマ（なければ通常テキスト）
  responseSchema?: any;
};

export async function runGemini({
  apiKey,
  model = "gemini-2.5-flash",
  text,
  timeoutMs = 90000,
  thinkingBudget = 512,
  responseSchema,
}: RunGeminiArgs): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const ai = new GoogleGenerativeAI(apiKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`Gemini request timeout after ${timeoutMs}ms`);
    ctrl.abort();
  }, timeoutMs);

  try {
    const config: any = {};
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }
    // thinkingBudget設定はGemini 2.5 Flashではサポートされていないためコメントアウト
    // if (typeof thinkingBudget === 'number' && thinkingBudget >= 0) {
    //   config.thinkingTokens = thinkingBudget;
    // }

    const modelInstance = ai.getGenerativeModel({ 
      model,
      generationConfig: config
    });

    // signal のみを使用（timeout オプションとの競合を回避）
    const result = await modelInstance.generateContent(text, {
      signal: ctrl.signal
    });

    return result.response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Gemini API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 校正用の構造化出力スキーマ
 */
export const issueSchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          ruleId: { type: "string" },
          severity: { type: "string", enum: ["info", "warn", "error"] },
          message: { type: "string" },
          category: { type: "string", enum: ["style", "grammar", "honorific", "consistency", "risk"] },
          // 位置決定用のフィールド（LLMはインデックスを返さない）
          quote: { type: "string" },         // 問題の実体
          before: { type: "string" },        // 直前の文脈(最大40文字)
          after: { type: "string" },         // 直後の文脈(最大40文字)
          nth: { type: "integer" },          // 同一quoteが複数ある場合、n番目(1始まり)
          range: {                           // （任意）あれば使うが、信用はしない
            type: "object",
            properties: {
              start: { type: "integer" },
              end: { type: "integer" }
            },
            required: ["start", "end"]
          },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                rationale: { type: "string" },
                confidence: { type: "number" },
                isPreferred: { type: "boolean" }
              },
              required: ["text"]
            }
          }
        },
        required: ["id", "severity", "category", "message"],
        propertyOrdering: [
          "id", "ruleId", "severity", "category", "message",
          "quote", "before", "after", "nth", "range", "suggestions"
        ]
      }
    }
  },
  required: ["issues"],
  propertyOrdering: ["issues"]
};

/**
 * テキスト正規化（改行統一 + NFKC正規化）
 */
function normalizeForMatch(s: string): string {
  // 1) 改行は \n に統一
  // 2) 互換正規化（全角/半角・類似文字の統一）
  return s.replace(/\r\n?/g, '\n').normalize('NFKC');
}

/**
 * グラフェム単位とUTF-16コードユニットのマッピング作成
 */
function buildIndexMaps(original: string) {
  // Intl.Segmenter の型定義を追加
  const Segmenter = (Intl as any).Segmenter;
  if (!Segmenter) {
    // フォールバック: 文字単位で処理
    const normOriginal = normalizeForMatch(original);
    const norm2cu: number[] = [];
    for (let i = 0; i < normOriginal.length; i++) {
      norm2cu[i] = Math.min(i, original.length - 1);
    }
    return { normOriginal, norm2cu };
  }
  
  const seg = new Segmenter('ja', { granularity: 'grapheme' });
  const graphemes = Array.from(seg.segment(original));
  const g2cu: Array<{ start: number; end: number; text: string }> = [];
  let cu = 0;
  for (const g of graphemes) {
    const t = (g as any).segment;
    const start = cu;
    const end = start + t.length; // UTF-16 code units
    g2cu.push({ start, end, text: t });
    cu = end;
  }
  
  // 正規化テキストと、正規化→元のUTF-16 への逆引き表も用意
  const normOriginal = normalizeForMatch(original);
  // normIndex -> original UTF-16 のざっくりマップ（必要十分精度）
  // 方針：元と正規化後を同じ順で走査して"おおむね"対応付け
  const norm2cu: number[] = [];
  let iOrig = 0;
  let iNorm = 0;
  while (iOrig < original.length && iNorm < normOriginal.length) {
    norm2cu[iNorm] = iOrig;
    // 1コードユニットずつ進める（NFKCで長さがズレる箇所は局所的に不一致だが、before/quote/after 検索の境界で十分）
    iOrig++; iNorm++;
  }
  return { normOriginal, norm2cu };
}

/**
 * 正規表現の特殊文字をエスケープ
 */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * before/quote/after で一意に検索して位置を決定
 */
function findRangeByContext(
  raw: string, 
  before = '', 
  quote = '', 
  after = '', 
  nth = 1
): { start: number; end: number } | null {
  const norm = normalizeForMatch(raw);
  const pat = new RegExp(
    `${escapeRe(before)}${escapeRe(quote)}${escapeRe(after)}`,
    'g'
  );
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = pat.exec(norm)) !== null) {
    count++;
    if (count === (nth || 1)) {
      const startNorm = match.index + before.length;
      const endNorm = startNorm + quote.length;
      // 正規化→元のUTF-16へ戻す
      const { norm2cu } = buildIndexMaps(raw);
      const startCU = norm2cu[startNorm] ?? 0;
      const endCU = norm2cu[endNorm] ?? startCU + quote.length;
      return { start: startCU, end: endCU };
    }
  }
  
  // 失敗時は quote 単体で nth 検索
  if (quote) {
    const q = new RegExp(escapeRe(quote), 'g');
    let hit: RegExpExecArray | null;
    let k = 0;
    while ((hit = q.exec(norm)) !== null) {
      k++;
      if (k === (nth || 1)) {
        const startNorm = hit.index;
        const endNorm = startNorm + quote.length;
        const { norm2cu } = buildIndexMaps(raw);
        const startCU = norm2cu[startNorm] ?? 0;
        const endCU = norm2cu[endNorm] ?? startCU + quote.length;
        return { start: startCU, end: endCU };
      }
    }
  }
  return null;
}

/**
 * 校正提案を生成（構造化出力版）
 */
export async function generateProofreadingSuggestions({
  apiKey,
  model = "gemini-2.5-flash",
  text,
  timeoutMs = 60000,
  thinkingBudget = 512,
}: {
  apiKey: string;
  model?: string;
  text: string;
  timeoutMs?: number;
  thinkingBudget?: number;
}): Promise<{
  success: boolean;
  issues?: import('@/types').Issue[];
  error?: string;
  elapsedMs?: number;
}> {
  const startTime = Date.now();
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY is required",
      elapsedMs: Date.now() - startTime
    };
  }
  
  try {
    console.log('Gemini校正提案生成開始:', { textLength: text.length });
    
    const prompt = `あなたは日本語の校正専門家です。以下のテキストを校正し、改善提案を行ってください。

テキスト:
${text}

必ず以下のJSON形式で応答してください。他のテキストは一切含めず、JSONのみを返してください:

{
  "issues": [
    {
      "id": "issue_1",
      "ruleId": "grammar_check",
      "severity": "info",
      "category": "style",
      "message": "問題の説明",
      "quote": "問題となる箇所そのもの",
      "before": "前後文脈の直前(最大40文字)",
      "after": "前後文脈の直後(最大40文字)",
      "nth": 1,
      "suggestions": [
        {
          "text": "修正案",
          "rationale": "修正理由",
          "confidence": 0.8,
          "isPreferred": false
        }
      ]
    }
  ]
}

注意事項:
- インデックス(start/end)は返さないでください（位置は私たちが決定します）
- quote: 問題となる箇所の実際の文字列を原文からそのまま抜粋してください
- before: quoteの直前の文脈を最大40文字で抜粋してください
- after: quoteの直後の文脈を最大40文字で抜粋してください
- nth: 同じquoteが複数ある場合、何番目かを指定してください（1始まり）
- 断定的でない表現を使用してください（「〜かもしれません」「〜を検討してください」など）
- 最大3個の提案まで生成してください
- 重要度は適切に設定してください（info: 軽微、warn: 注意、error: 重要）
- 問題がない場合は空の配列を返してください: {"issues": []}`;

    console.log('runGemini呼び出し開始');
    const response = await runGemini({
      apiKey,
      model,
      text: prompt,
      timeoutMs,
      thinkingBudget,
      responseSchema: issueSchema,
    });
    console.log('runGemini呼び出し完了');

    console.log('Gemini raw response:', response);

    // マークダウンのコードブロックを除去
    let cleanResponse = response;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }
    if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```\n?/g, '');
    }

    console.log('Cleaned response:', cleanResponse);

    const parsed = JSON.parse(cleanResponse);
    
    // 各issueにsourceフィールドを追加し、文脈検索で位置を決定
    const issuesWithSource = (parsed.issues || []).map((issue: any, idx: number) => {
      const {
        suggestions: rawSuggestions,
        suggestion: legacySuggestion,
        quote = '',
        before = '',
        after = '',
        nth = 1,
        ...rest
      } = issue || {};

      // 位置は LLM ではなくローカルで決定
      let start = 0, end = 1;
      const located = findRangeByContext(text, before, quote, after, nth);
      if (located) {
        start = located.start;
        end = Math.max(located.end, start + 1);
      } else if (typeof rest.range?.start === 'number' && typeof rest.range?.end === 'number') {
        // 最後の保険：LLM 提示の index（信用度低）を使用
        start = Math.max(0, rest.range.start);
        end = Math.max(start + 1, rest.range.end);
      }
      const normalizedSuggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions.map((s: any) => ({
            text: s?.text ?? '',
            rationale: s?.rationale ?? 'LLMによる提案',
            confidence: typeof s?.confidence === 'number'
              ? Math.max(0, Math.min(1, s.confidence))
              : 0.5,
            isPreferred: Boolean(s?.isPreferred)
          }))
        : legacySuggestion
          ? [{ text: legacySuggestion, rationale: 'LLMによる提案', confidence: 0.5, isPreferred: false }]
          : [];

      const normalizedCategory = ['style','grammar','honorific','consistency','risk'].includes(rest.category)
        ? rest.category : 'style';
      const normalizedSeverity = ['info','warn','error'].includes(rest.severity)
        ? rest.severity : 'info';

      return {
        ...rest,
        start,
        end,
        range: { start, end },
        quote,
        before,
        after,
        nth,
        source: "llm" as const,
        category: normalizedCategory,
        severity: normalizedSeverity,
        suggestions: normalizedSuggestions,
        metadata: {
          ...rest.metadata,
          llmGenerated: true,
          anchorStrategy: 'context-search'
        }
      };
    });
    
    return {
      success: true,
      issues: issuesWithSource,
      elapsedMs: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '不明なエラー',
      elapsedMs: Date.now() - startTime
    };
  }
}
