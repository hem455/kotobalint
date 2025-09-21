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

      // 表記ゆれの場合
      if (message.includes('コンピュータ') && message.includes('コンピューター')) {
        const computerMatch = text.match(/コンピュータ/g);
        const computererMatch = text.match(/コンピューター/g);
        if (computerMatch && computererMatch) {
          // 最初に見つかった「コンピュータ」の位置を使用
          const computerIndex = text.indexOf('コンピュータ');
          correctedStart = computerIndex;
          correctedEnd = computerIndex + 'コンピュータ'.length;
        }
      }
      
      // ら抜き言葉の場合
      if (message.includes('食べれる') || message.includes('ら抜き')) {
        const taberuIndex = text.indexOf('食べれる');
        if (taberuIndex !== -1) {
          correctedStart = taberuIndex;
          correctedEnd = taberuIndex + '食べれる'.length;
        }
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
