import { NextRequest, NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini-client';
import { streamingClient } from '@/lib/streaming-client';
import { observabilityManager } from '@/lib/observability';
import type { SuggestRequest, ApiResponse } from '@/types';

// Geminiクライアントのシングルトンインスタンス
let geminiClient: GeminiClient | null = null;

/**
 * Geminiクライアントを初期化
 */
function initializeGeminiClient(): GeminiClient {
  if (!geminiClient) {
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
 * POST /api/suggest/stream - ストリーミングでLLMによる校正提案を生成
 */
export async function POST(request: NextRequest): Promise<Response> {
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

    // ストリーミングレスポンスの設定
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // ストリーミング開始
        const sendChunk = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };

        // エラー送信
        const sendError = (error: string) => {
          sendChunk({
            success: false,
            error: {
              code: 'STREAM_ERROR',
              message: error
            }
          });
          controller.close();
        };

        // ストリーミング開始メッセージ
        sendChunk({
          success: true,
          message: 'ストリーミング開始',
          meta: {
            elapsedMs: Date.now() - startTime,
            model: 'gemini-2.0-flash-exp'
          }
        });

        // ストリーミングクライアントで提案を生成
        streamingClient.generateSuggestionsStream(body, {
          onChunk: (chunk) => {
            sendChunk({
              success: true,
              data: chunk,
              meta: {
                elapsedMs: Date.now() - startTime
              }
            });
          },
          onComplete: (issues) => {
            sendChunk({
              success: true,
              data: {
                issues,
                isComplete: true
              },
              meta: {
                elapsedMs: Date.now() - startTime,
                totalIssues: issues.length
              }
            });
            controller.close();
          },
          onError: (error) => {
            observabilityManager.recordCancellation();
            sendError(error);
          },
          onCancel: () => {
            observabilityManager.recordCancellation();
            sendChunk({
              success: true,
              message: 'ストリーミングがキャンセルされました',
              isComplete: true
            });
            controller.close();
          }
        }).catch((error) => {
          sendError(error.message);
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Streaming Suggest API エラー:', error);
    
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
 * GET /api/suggest/stream - ストリーミング状態の確認
 */
export async function GET(): Promise<NextResponse<ApiResponse<{
  status: string;
  isStreaming: boolean;
  canCancel: boolean;
  metrics: any;
}>>> {
  try {
    const streamingState = streamingClient.getStreamingState();
    const healthStatus = observabilityManager.getHealthStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'ready',
        isStreaming: streamingState.isStreaming,
        canCancel: streamingState.canCancel,
        metrics: healthStatus.metrics
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'ストリーミングサービスが利用できません'
      }
    }, { status: 503 });
  }
}

/**
 * DELETE /api/suggest/stream - ストリーミングのキャンセル
 */
export async function DELETE(): Promise<NextResponse<ApiResponse<{
  message: string;
}>>> {
  try {
    streamingClient.cancel();
    observabilityManager.recordCancellation();
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'ストリーミングがキャンセルされました'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'CANCEL_ERROR',
        message: 'キャンセルに失敗しました'
      }
    }, { status: 500 });
  }
}
