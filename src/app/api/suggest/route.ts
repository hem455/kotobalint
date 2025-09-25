import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { generateProofreadingSuggestions } from '@/lib/gemini-client';
import { containsSecret, detectSecretType } from '@/lib/secret-guard';
import { schemaValidator } from '@/lib/schema-validator';
import { observabilityManager } from '@/lib/observability';
import type { SuggestRequest, SuggestResponse, ApiResponse } from '@/types';
import type { LlmProvider, LlmSettings, LlmModel } from '@/types/llm';
import { AVAILABLE_MODELS, DEFAULT_LLM_SETTINGS } from '@/types/llm';

export const runtime = "nodejs";

// ローカルLLM（Ollama/OpenAI互換）は廃止。Gemini専用。

/**
 * テキストをサニタイズ（ログ用のみ）
 */
function sanitizeForLogging(text: string): string {
  // 本番環境ではログを出力しない
  if (process.env.NODE_ENV === 'production') {
    return '[redacted]';
  }
  
  // 開発環境では簡易サニタイズ
  return text.replace(/[^\s\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '*');
}

/**
 * LLMレスポンスをIssue配列に変換
 */
function parseLLMResponse(response: string, originalText: string): any[] {
  try {
    // JSON部分を抽出
    let jsonString = response;
    
    // ```json コードブロックを探す
    const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1];
    } else {
      // コードブロックが見つからない場合、最初の '{' と最後の '}' を探す
      const firstBrace = response.indexOf('{');
      const lastBrace = response.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = response.substring(firstBrace, lastBrace + 1);
      }
    }
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.warn('JSON parse error:', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        jsonPreview: jsonString.substring(0, 200) + (jsonString.length > 200 ? '...' : ''),
        jsonLength: jsonString.length
      });
      return [];
    }
    
    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      console.warn('LLM レスポンスに issues 配列がありません');
      return [];
    }

    return parsed.issues.map((issue: any, index: number) => ({
      id: `llm_${issue.id || index}_${randomUUID()}`,
      source: 'llm',
      severity: ['info', 'warn', 'error'].includes(issue.severity) ? issue.severity : 'info',
      category: ['style', 'grammar', 'honorific', 'consistency', 'risk'].includes(issue.category) ? issue.category : 'style',
      message: issue.message || 'LLMによる提案',
      range: issue.range || { start: 0, end: originalText.length },
      suggestions: (issue.suggestions || []).map((suggestion: any) => ({
        text: suggestion.text || suggestion,
        rationale: suggestion.rationale || 'LLMによる提案',
        confidence: Math.max(0, Math.min(1, suggestion.confidence || 0.5)),
        isPreferred: suggestion.isPreferred || false
      })),
      metadata: {
        llmGenerated: true,
        confidence: issue.confidence || 0.5
      }
    }));

  } catch (error) {
    console.error('LLM レスポンスの解析エラー:', error);
    console.error('レスポンス内容:', response);
    return [];
  }
}

/**
 * POST /api/suggest - LLMによる校正提案の生成
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SuggestResponse>>> {
  const startTime = Date.now();
  
  try {
    // リクエストボディの解析
    const body: SuggestRequest = await request.json();
    
    // バリデーション
    if (!body.passages || !Array.isArray(body.passages) || body.passages.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'テキスト抜粋が指定されていません'
        }
      }, { status: 400 });
    }

    // 環境変数から LLM 設定を構築（デフォルトは Gemini 2.5 Flash）
    // Gemini固定
    const envProvider: LlmProvider = 'gemini';    const rawEnvModel = process.env.LLM_MODEL;
    const defaultModel = (DEFAULT_LLM_SETTINGS[envProvider].model as LlmModel) || 'gemini-2.5-flash';
    const envModel: LlmModel = (rawEnvModel && (AVAILABLE_MODELS[envProvider] as LlmModel[]).includes(rawEnvModel as LlmModel))
      ? (rawEnvModel as LlmModel)
      : defaultModel;
    const envBaseUrl = process.env.LLM_BASE_URL || (DEFAULT_LLM_SETTINGS[envProvider].baseUrl as string) || 'https://generativelanguage.googleapis.com';
    const envApiKey = process.env.GEMINI_API_KEY || '';
    const envTimeoutMs = Number.parseInt(process.env.LLM_TIMEOUT_MS || '', 10);
    const envMaxSuggestions = Number.parseInt(process.env.LLM_MAX_SUGGESTIONS || '', 10);
    const envThinkingBudget = Number.parseInt(process.env.LLM_THINKING_BUDGET || '', 10);
    const envEnabled = (process.env.LLM_ENABLED ?? 'true').toLowerCase() === 'true';

    const settings: LlmSettings = {
      enabled: envEnabled,
      provider: envProvider,
      model: envModel,
      baseUrl: envBaseUrl,
      apiKey: envApiKey,
      timeoutMs: Number.isFinite(envTimeoutMs) ? envTimeoutMs : 30000,
      maxSuggestions: Number.isFinite(envMaxSuggestions) ? envMaxSuggestions : 3,
      thinkingBudget: Number.isFinite(envThinkingBudget) ? envThinkingBudget : 512
    };

    if (!settings.enabled) {
      return NextResponse.json({
        success: true,
        data: {
          issues: [],
          meta: {
            elapsedMs: Date.now() - startTime,
            model: settings.model,
            tokensUsed: 0
          }
        }
      });
    }

    // テキストの結合
    const fullText = body.passages.map(p => p.text).join('\n');
    const maskedForLogs = sanitizeForLogging(fullText);
    
    // シークレット検知（送信を拒否）
    if (containsSecret(fullText)) {
      const secretTypes = detectSecretType(fullText);
      // 内部ログのみに詳細情報を記録（セキュリティのため）
      console.warn('Secret detected in request:', { 
        secretTypes, 
        textLength: fullText.length,
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json({
        success: false,
        error: {
          code: 'SECRET_DETECTED',
          message: '入力内に機密らしき文字列が含まれます。修正して再送してください。'
        }
      }, { status: 400 });
    }
    
    // LLMに送るテキストは原文（ノーマスク）
    const textForLLM = fullText;
    
    // ログ用サニタイズ（開発環境のみ）
    if (process.env.NODE_ENV !== 'production') {
      console.log("Sanitized input (masked):", maskedForLogs);
    }

    // プロンプトインジェクション対策（テンプレート埋め込み前にエスケープ）
    const sanitizedTextForPrompt = textForLLM
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/\n{3,}/g, "\n\n") // 過度な改行を制限
      .substring(0, 10000); // 最大文字数制限
    // プロンプトの構築
    const prompt = `あなたは日本語の校正専門家です。以下のテキストを校正し、改善提案を行ってください。

テキスト:
${sanitizedTextForPrompt}

以下の形式でJSONレスポンスを返してください:
{
  "issues": [
    {
      "id": "unique_id",
      "severity": "info|warn|error",
      "category": "style|grammar|honorific|consistency|risk",
      "message": "問題の説明",
      "range": {"start": 0, "end": 10},
      "suggestions": [
        {
          "text": "修正案",
          "rationale": "修正理由",
          "confidence": 0.8
        }
      ]
    }
  ]
}

注意事項:
- 断定的でない表現を使用してください（「〜かもしれません」「〜を検討してください」など）
- 最大${settings.maxSuggestions || 3}個の提案まで生成してください
- 各提案には信頼度（confidence）を含めてください
- 問題の範囲（range）は元のテキスト内の文字位置で指定してください
- 重要度は適切に設定してください（info: 軽微、warn: 注意、error: 重要）`;

    // 設定のバリデーション
    if (!settings.provider || !settings.model) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'LLM設定が不完全です'
        }
      }, { status: 400 });
    }

    // デフォルトモデルの適用
    settings.model = settings.model || 'gemini-2.5-flash';

    // プロバイダー別の処理（Geminiのみ）
    let issues: any[] = [];

    // Gemini 2.5 Flashによる構造化出力
    if (process.env.NODE_ENV !== 'production') {
      console.debug("Gemini API Key available:", Boolean(settings.apiKey));
      console.debug("Environment GEMINI_API_KEY available:", Boolean(process.env.GEMINI_API_KEY));
    }

    const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key not configured: set process.env.GEMINI_API_KEY or provide settings.apiKey");
    }

    console.log('Gemini API呼び出し開始:', { model: settings.model, textLength: textForLLM.length });
    
    const geminiResult = await generateProofreadingSuggestions({
      apiKey,
      model: settings.model,
      text: textForLLM,
      timeoutMs: settings.timeoutMs,
      thinkingBudget: settings.thinkingBudget
    });
    
    console.log('Gemini API呼び出し完了:', { success: geminiResult.success, issuesCount: geminiResult.issues?.length || 0 });

    if (!geminiResult.success) {
      console.warn('Gemini generation failed, falling back to empty suggestions:', geminiResult.error);
      return NextResponse.json({
        success: true,
        data: {
          issues: [],
          meta: {
            elapsedMs: Date.now() - startTime,
            model: settings.model,
            tokensUsed: Math.ceil(textForLLM.length / 4),
            notice: 'LLM提案は現在利用できません（フォールバック）'
          }
        }
      });
    }

    issues = geminiResult.issues || [];

    // スキーマ検証
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Issues before validation:', JSON.stringify(issues, null, 2));
    }
    
    const validationResult = schemaValidator.validateLLMResponse({ issues });
    if (!validationResult.isValid) {
      console.warn('LLM レスポンスのスキーマ検証に失敗:', validationResult.errors);
      console.warn('Validation details:', {
        issuesCount: issues.length,
        firstIssue: issues[0],
        validationErrors: validationResult.errors
      });
      
      // フォールバック応答を使用
      const fallbackResponse = schemaValidator.generateSafeFallback();
      return NextResponse.json({
        success: true,
        data: {
          issues: fallbackResponse.issues,
          meta: {
            elapsedMs: Date.now() - startTime,
            model: settings.model,
            tokensUsed: Math.ceil(textForLLM.length / 4)
          }
        }
      });
    }

    // 成功を記録
    const normalizedIssues = validationResult.sanitizedData?.issues ?? issues;

    observabilityManager.recordSuccess(
      maskedForLogs,
      normalizedIssues,
      Date.now() - startTime
    );

    return NextResponse.json({
      success: true,
      data: {
        issues: normalizedIssues,
        meta: {
          elapsedMs: Date.now() - startTime,
          model: settings.model,
          tokensUsed: Math.ceil(textForLLM.length / 4)
        }
      }
    });

  } catch (error) {
    console.error('Suggest API エラー:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'LLMによる提案生成に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}
