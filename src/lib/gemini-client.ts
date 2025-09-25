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
  timeoutMs = 60000,
  thinkingBudget = 512,
  responseSchema,
}: RunGeminiArgs): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }

  const ai = new GoogleGenerativeAI(apiKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

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

    const result = await modelInstance.generateContent(text, {
      signal: ctrl.signal,
      timeout: timeoutMs
    });

    return result.response.text();
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
          start: { type: "integer" },
          end: { type: "integer" },
          range: {
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
        required: ["id", "severity", "category", "message", "range"],
        propertyOrdering: [
          "id",
          "ruleId",
          "severity",
          "category",
          "message",
          "start",
          "end",
          "range",
          "suggestions"
        ]
      }
    }
  },
  required: ["issues"],
  propertyOrdering: ["issues"]
};

/**
 * 校正提案を生成（構造化出力版）
 */
export async function generateProofreadingSuggestions({
  apiKey,
  model = "gemini-2.5-flash",
  text,
  timeoutMs = 30000,
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
      "range": {
        "start": 0,
        "end": 5
      },
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
- 必ずJSON形式で応答してください
- 断定的でない表現を使用してください（「〜かもしれません」「〜を検討してください」など）
- 最大3個の提案まで生成してください
- 問題の範囲（start, end）は元のテキスト内の文字位置で指定してください（JavaScript文字列の0ベースインデックス）
- 文字位置は正確に計算してください。テキストの最初の文字は0、次の文字は1、というように数えてください
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
    
    // 各issueにsourceフィールドを追加し、位置を正規表現で修正
    // 追加: 汎用的な校正パターンと位置検出ロジック
    const CORRECTION_PATTERNS: Array<{
      pattern: RegExp | string; // issue.message に対する判定
      matchText: RegExp | string; // 原文 text から位置を取る対象
      suggestion?: string;
    }> = [
      {
        // 表記ゆれ: コンピュータ/コンピューター
        pattern: /(コンピュータ|コンピューター)/,
        matchText: /(コンピュータ|コンピューター)/g,
        suggestion: 'コンピューター'
      },
      {
        // ら抜き言葉: 食べれる
        pattern: /(食べれる|ら抜き)/,
        matchText: /食べれる/g,
        suggestion: '食べられる'
      },
    ];

    const findTextPosition = (sourceText: string, issueLike: { message?: string }): { start: number; end: number } | null => {
      const msg = issueLike?.message || '';
      for (const def of CORRECTION_PATTERNS) {
        const triggerMatched = typeof def.pattern === 'string'
          ? msg.includes(def.pattern)
          : def.pattern.test(msg);
        // メッセージに合致しない場合でも、テキスト内に対象語があれば位置を返す（フォールバック）
        if (!triggerMatched) {
          // フォールバック: matchText をテキストから検索
          if (typeof def.matchText === 'string') {
            const idx = sourceText.indexOf(def.matchText);
            if (idx !== -1) {
              return { start: idx, end: idx + def.matchText.length };
            }
            continue;
          } else {
            def.matchText.lastIndex = 0;
            const m2 = def.matchText.exec(sourceText);
            if (m2 && typeof m2.index === 'number') {
              const matched2 = m2[0] ?? '';
              const s2 = m2.index;
              return { start: s2, end: s2 + matched2.length };
            }
            continue;
          }
        }

        if (typeof def.matchText === 'string') {
          const idx = sourceText.indexOf(def.matchText);
          if (idx !== -1) {
            return { start: idx, end: idx + def.matchText.length };
          }
        } else {
          def.matchText.lastIndex = 0; // 念のため先頭から
          const m = def.matchText.exec(sourceText);
          if (m && typeof m.index === 'number') {
            const matched = m[0] ?? '';
            const s = m.index;
            return { start: s, end: s + matched.length };
          }
        }
      }
      return null;
    };

    const issuesWithSource = (parsed.issues || []).map((issue: any) => {
      const {
        suggestions: rawSuggestions,
        suggestion: legacySuggestion,
        ...rest
      } = issue || {};
      // 問題のテキストから実際の位置を検索
      const initialRange = rest.range || {};
      let correctedStart = typeof initialRange.start === 'number' ? initialRange.start : issue.start;
      let correctedEnd = typeof initialRange.end === 'number' ? initialRange.end : issue.end;

      // メッセージから問題のキーワードを抽出して位置を修正
      const message = rest.message || '';

      // 汎用パターンで検索して位置を補正
      const found = findTextPosition(text, { message });
      if (found) {
        correctedStart = found.start;
        correctedEnd = found.end;
      }

      const safeStart = typeof correctedStart === 'number' && correctedStart >= 0 ? correctedStart : 0;
      const safeEnd = typeof correctedEnd === 'number' && correctedEnd > safeStart ? correctedEnd : safeStart + 1;

      const normalizedSuggestions = Array.isArray(rawSuggestions)
        ? rawSuggestions.map((suggestion: any) => ({
            text: suggestion?.text ?? '',
            rationale: suggestion?.rationale ?? 'LLMによる提案',
            confidence: typeof suggestion?.confidence === 'number'
              ? Math.max(0, Math.min(1, suggestion.confidence))
              : 0.5,
            isPreferred: Boolean(suggestion?.isPreferred)
          }))
        : legacySuggestion
          ? [{
              text: legacySuggestion,
              rationale: 'LLMによる提案',
              confidence: 0.5,
              isPreferred: false
            }]
          : [];

      const normalizedCategory = ['style', 'grammar', 'honorific', 'consistency', 'risk'].includes(rest.category)
        ? rest.category
        : 'style';

      const normalizedSeverity = ['info', 'warn', 'error'].includes(rest.severity)
        ? rest.severity
        : 'info';

      return {
        ...rest,
        start: safeStart,
        end: safeEnd,
        range: {
          start: safeStart,
          end: safeEnd
        },
        source: "llm" as const,
        category: normalizedCategory,
        severity: normalizedSeverity,
        suggestions: normalizedSuggestions,
        metadata: {
          ...rest.metadata,
          llmGenerated: true,
          confidence: typeof rest.confidence === 'number'
            ? Math.max(0, Math.min(1, rest.confidence))
            : normalizedSuggestions[0]?.confidence ?? 0.5
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
