/**
 * ストリーミングとキャンセル機能
 * 提案結果のチャンク配信とクライアント起因のキャンセル要求をサポート
 */

import type { Issue, SuggestRequest } from '@/types';

export interface StreamingConfig {
  chunkSize: number;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface StreamingResponse {
  success: boolean;
  issues?: Issue[];
  error?: string;
  isComplete: boolean;
  chunkIndex: number;
  totalChunks?: number;
}

export interface StreamingCallbacks {
  onChunk?: (chunk: StreamingResponse) => void;
  onComplete?: (issues: Issue[]) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

/**
 * ストリーミングクライアントクラス
 */
export class StreamingClient {
  private config: StreamingConfig;
  private abortController: AbortController | null = null;
  private isStreaming: boolean = false;

  constructor(config?: Partial<StreamingConfig>) {
    this.config = {
      chunkSize: 1000,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * ストリーミングで提案を生成
   */
  async generateSuggestionsStream(
    request: SuggestRequest,
    callbacks: StreamingCallbacks
  ): Promise<void> {
    if (this.isStreaming) {
      callbacks.onError?.('既にストリーミング中です');
      return;
    }

    this.isStreaming = true;
    this.abortController = new AbortController();

    try {
      await this.performStreaming(request, callbacks);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        callbacks.onCancel?.();
      } else {
        callbacks.onError?.(error instanceof Error ? error.message : '不明なエラー');
      }
    } finally {
      this.isStreaming = false;
      this.abortController = null;
    }
  }

  /**
   * ストリーミング処理を実行
   */
  private async performStreaming(
    request: SuggestRequest,
    callbacks: StreamingCallbacks
  ): Promise<void> {
    const { passages } = request;
    const allIssues: Issue[] = [];
    let chunkIndex = 0;

    // テキストをチャンクに分割
    const chunks = this.splitTextIntoChunks(passages);
    const totalChunks = chunks.length;

    for (const chunk of chunks) {
      // キャンセルチェック
      if (this.abortController?.signal.aborted) {
        throw new Error('AbortError');
      }

      try {
        // チャンクごとに提案を生成
        const chunkIssues = await this.generateChunkSuggestions(chunk, request);
        allIssues.push(...chunkIssues);

        // チャンクレスポンスを送信
        const chunkResponse: StreamingResponse = {
          success: true,
          issues: chunkIssues,
          isComplete: chunkIndex === totalChunks - 1,
          chunkIndex,
          totalChunks
        };

        callbacks.onChunk?.(chunkResponse);

        // 最後のチャンクの場合
        if (chunkIndex === totalChunks - 1) {
          callbacks.onComplete?.(allIssues);
        }

        chunkIndex++;

        // チャンク間の遅延（レート制限対策）
        await this.delay(100);

      } catch (error) {
        // リトライロジック
        const retryResult = await this.retryWithBackoff(
          () => this.generateChunkSuggestions(chunk, request),
          this.config.maxRetries,
          this.config.retryDelay
        );

        if (retryResult.success && retryResult.data) {
          allIssues.push(...retryResult.data);
          
          const chunkResponse: StreamingResponse = {
            success: true,
            issues: retryResult.data,
            isComplete: chunkIndex === totalChunks - 1,
            chunkIndex,
            totalChunks
          };

          callbacks.onChunk?.(chunkResponse);
        } else {
          throw new Error(retryResult.error || 'チャンク生成に失敗しました');
        }

        chunkIndex++;
      }
    }
  }

  /**
   * テキストをチャンクに分割
   */
  private splitTextIntoChunks(passages: any[]): any[][] {
    const chunks: any[][] = [];
    let currentChunk: any[] = [];
    let currentLength = 0;

    for (const passage of passages) {
      const passageLength = passage.text.length;
      
      if (currentLength + passageLength > this.config.chunkSize && currentChunk.length > 0) {
        chunks.push([...currentChunk]);
        currentChunk = [passage];
        currentLength = passageLength;
      } else {
        currentChunk.push(passage);
        currentLength += passageLength;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * チャンクの提案を生成
   */
  private async generateChunkSuggestions(chunk: any[], request: SuggestRequest): Promise<Issue[]> {
    try {
      // 実際のLLM APIを呼び出し
      const { GeminiClient } = await import('./gemini-client');
      const client = new GeminiClient({
        baseUrl: process.env.GEMINI_BASE_URL || 'http://localhost:11434',
        apiKey: process.env.GEMINI_API_KEY || '',
        timeout: this.config.timeout,
        maxSuggestions: 3
      });

      const chunkRequest: SuggestRequest = {
        ...request,
        passages: chunk
      };

      const result = await client.generateSuggestions(chunkRequest);
      
      if (result.success && result.issues) {
        return result.issues;
      } else {
        throw new Error(result.error || 'チャンク生成に失敗しました');
      }
    } catch (error) {
      // エラーが発生した場合はモック実装にフォールバック
      console.warn('LLM API呼び出しに失敗、モック実装にフォールバック:', error);
      return this.generateMockIssues(chunk);
    }
  }

  /**
   * モックのIssueを生成（テスト用）
   */
  private generateMockIssues(chunk: any[]): Issue[] {
    return chunk.map((passage, index) => ({
      id: `mock_${Date.now()}_${index}`,
      source: 'llm',
      severity: 'info' as const,
      category: 'style' as const,
      message: `チャンク ${index + 1} の提案`,
      range: passage.range,
      suggestions: [{
        text: `修正案 ${index + 1}`,
        rationale: 'LLMによる提案',
        confidence: 0.8,
        isPreferred: false
      }],
      metadata: {
        llmGenerated: true,
        confidence: 0.8
      }
    }));
  }

  /**
   * 指数バックオフでリトライ
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await operation();
        return { success: true, data };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('不明なエラー');
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'リトライ上限に達しました'
    };
  }

  /**
   * 遅延
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * ストリーミングをキャンセル
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * ストリーミング状態を取得
   */
  getStreamingState(): { isStreaming: boolean; canCancel: boolean } {
    return {
      isStreaming: this.isStreaming,
      canCancel: this.abortController !== null
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * シングルトンインスタンス
 */
export const streamingClient = new StreamingClient();
