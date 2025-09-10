import { NextRequest, NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini-client';
import { streamingClient } from '@/lib/streaming-client';
import { observabilityManager } from '@/lib/observability';
import type { SuggestRequest, SuggestResponse, ApiResponse } from '@/types';

// Geminiクライアントのシングルトンインスタンス
let geminiClient: GeminiClient | null = null;

// 接続テストの状態管理（並行性安全性のため）
let connectionTested: boolean = false;
let connectionTestPromise: Promise<{ success: boolean; error?: string; responseTime?: number }> | null = null;

/**
 * Geminiクライアントを初期化
 */
function initializeGeminiClient(): GeminiClient {
  if (!geminiClient) {
    // デフォルト設定（実際のアプリケーションでは設定から読み込む）
    geminiClient = new GeminiClient({
      baseUrl: process.env.GEMINI_BASE_URL || 'http://localhost:11434',
      apiKey: process.env.GEMINI_API_KEY || '',
      timeout: parseInt(process.env.GEMINI_TIMEOUT || '10000'),
      maxSuggestions: parseInt(process.env.GEMINI_MAX_SUGGESTIONS || '3')
    });
  }
  
  return geminiClient;
}

/**
 * POST /api/suggest - LLMによる校正提案の生成（ストリーミング対応）
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

    if (!body.style || typeof body.style !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'コンテンツスタイルが指定されていません'
        }
      }, { status: 400 });
    }

    // テキスト抜粋の検証
    for (const passage of body.passages) {
      if (!passage.text || typeof passage.text !== 'string') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '無効なテキスト抜粋が含まれています'
          }
        }, { status: 400 });
      }

      if (!passage.range || typeof passage.range.start !== 'number' || typeof passage.range.end !== 'number') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '無効なテキスト範囲が含まれています'
          }
        }, { status: 400 });
      }

      // テキスト範囲の境界値検証
      if (passage.range.start < 0 || 
          passage.range.start > passage.range.end || 
          passage.range.end > passage.text.length) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '無効なテキスト範囲が含まれています'
          }
        }, { status: 400 });
      }
    }

    // 文字数制限チェック（合計1000文字）
    const totalTextLength = body.passages.reduce((sum, passage) => sum + passage.text.length, 0);
    if (totalTextLength > 1000) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TEXT_TOO_LONG',
          message: 'テキスト抜粋が長すぎます（最大1000文字）'
        }
      }, { status: 400 });
    }

    // Geminiクライアントの初期化
    const client = initializeGeminiClient();
    
    // 接続テスト（並行性安全性を考慮）
    if (!connectionTested) {
      if (!connectionTestPromise) {
        connectionTestPromise = client.testConnection();
      }
      
      try {
        const connectionTest = await connectionTestPromise;
        if (!connectionTest.success) {
          // 失敗時はPromiseをリセット
          connectionTestPromise = null;
          return NextResponse.json({
            success: false,
            error: {
              code: 'LLM_UNAVAILABLE',
              message: 'LLMサービスが利用できません',
              details: connectionTest.error
            }
          }, { status: 503 });
        }
        connectionTested = true;
      } catch (error) {
        // エラー時はPromiseをリセット
        connectionTestPromise = null;
        return NextResponse.json({
          success: false,
          error: {
            code: 'LLM_UNAVAILABLE',
            message: 'LLMサービスが利用できません',
            details: error instanceof Error ? error.message : '不明なエラー'
          }
        }, { status: 503 });
      }
    }

    // 校正提案の生成
    const result = await client.generateSuggestions(body);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LLM_ERROR',
          message: 'LLMによる提案生成に失敗しました',
          details: result.error
        }
      }, { status: 500 });
    }

    // レスポンスの構築
    const response: SuggestResponse = {
      issues: result.issues || [],
      meta: {
        elapsedMs: result.elapsedMs || (Date.now() - startTime),
        model: 'gemini-2.0-flash-exp',
        tokensUsed: Math.ceil(totalTextLength / 4) // 概算
      }
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Suggest API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '内部サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/suggest - ヘルスチェック
 */
export async function GET(): Promise<NextResponse<ApiResponse<{
  status: string;
  llmAvailable: boolean;
  model: string;
  responseTime?: number;
  metrics?: any;
}>>> {
  try {
    const client = initializeGeminiClient();
    const connectionTest = await client.testConnection();
    const healthStatus = observabilityManager.getHealthStatus();
    
    const statusCode = connectionTest.success ? 200 : 503;
    
    return NextResponse.json({
      success: true,
      data: {
        status: connectionTest.success ? 'healthy' : 'unhealthy',
        llmAvailable: connectionTest.success,
        model: 'gemini-2.0-flash-exp',
        responseTime: connectionTest.responseTime,
        metrics: healthStatus.metrics
      }
    }, { status: statusCode });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'LLMサービスが利用できません'
      }
    }, { status: 503 });
  }
}
