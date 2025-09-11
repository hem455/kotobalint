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

    const modelInstance = ai.getGenerativeModel({ 
      model,
      generationConfig: config
    });

    const result = await modelInstance.generateContent(text);

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
          start: { type: "integer" },
          end: { type: "integer" },
          suggestion: { type: "string" },
          range: {
            type: "object",
            properties: {
              start: { type: "integer" },
              end: { type: "integer" }
            },
            required: ["start", "end"]
          }
        },
        required: ["id", "ruleId", "severity", "message"],
        propertyOrdering: ["id", "ruleId", "severity", "message", "start", "end", "suggestion", "range"]
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
      "message": "問題の説明",
      "start": 0,
      "end": 5,
      "suggestion": "修正案",
      "range": {
        "start": 0,
        "end": 5
      }
    }
  ]
}

注意事項:
- 必ずJSON形式で応答してください
- 断定的でない表現を使用してください（「〜かもしれません」「〜を検討してください」など）
- 最大3個の提案まで生成してください
- 問題の範囲（start, end）は元のテキスト内の文字位置で指定してください
- 重要度は適切に設定してください（info: 軽微、warn: 注意、error: 重要）
- 問題がない場合は空の配列を返してください: {"issues": []}`;

    const response = await runGemini({
      apiKey,
      model,
      text: prompt,
      timeoutMs,
      thinkingBudget,
      responseSchema: issueSchema,
    });

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
    
    return {
      success: true,
      issues: parsed.issues || [],
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