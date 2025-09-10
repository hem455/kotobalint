/**
 * 可観測性とエラーハンドリング機能
 * メトリクス収集、監査ログ、タイムアウト・リトライ機能を提供
 */

import type { Issue } from '@/types';

export interface Metrics {
  latency: number;
  successRate: number;
  rejectionCount: number;
  schemaValidationFailures: number;
  cancellationCount: number;
  retryCount: number;
  piiDetectionCount: number;
  promptInjectionAttempts: number;
}

export interface AuditLog {
  timestamp: string;
  event: string;
  maskedInput: string;
  rejectionReason?: string;
  schemaValidationError?: string;
  fallbackOccurred: boolean;
  metadata: Record<string, any>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * 可観測性マネージャークラス
 */
export class ObservabilityManager {
  private metrics: Metrics;
  private auditLogs: AuditLog[];
  private retryConfig: RetryConfig;
  private maxLogs: number;

  constructor(config?: {
    retryConfig?: Partial<RetryConfig>;
    maxLogs?: number;
  }) {
    this.metrics = {
      latency: 0,
      successRate: 0,
      rejectionCount: 0,
      schemaValidationFailures: 0,
      cancellationCount: 0,
      retryCount: 0,
      piiDetectionCount: 0,
      promptInjectionAttempts: 0
    };

    this.auditLogs = [];
    this.maxLogs = config?.maxLogs || 1000;

    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      ...config?.retryConfig
    };
  }

  /**
   * メトリクスを記録
   */
  recordMetric(metric: keyof Metrics, value: number): void {
    this.metrics[metric] = value;
  }

  /**
   * メトリクスを増加
   */
  incrementMetric(metric: keyof Metrics, increment: number = 1): void {
    this.metrics[metric] += increment;
  }

  /**
   * 成功率を更新
   */
  updateSuccessRate(successful: number, total: number): void {
    this.metrics.successRate = total > 0 ? (successful / total) * 100 : 0;
  }

  /**
   * 監査ログを記録
   */
  recordAuditLog(log: Omit<AuditLog, 'timestamp'>): void {
    const auditLog: AuditLog = {
      ...log,
      timestamp: new Date().toISOString()
    };

    this.auditLogs.push(auditLog);

    // ログ数制限
    if (this.auditLogs.length > this.maxLogs) {
      this.auditLogs = this.auditLogs.slice(-this.maxLogs);
    }
  }

  /**
   * PII検出を記録
   */
  recordPIIDetection(maskedInput: string, piiMatches: any[]): void {
    this.incrementMetric('piiDetectionCount');
    
    this.recordAuditLog({
      event: 'PII_DETECTED',
      maskedInput,
      fallbackOccurred: false,
      metadata: {
        piiCount: piiMatches.length,
        piiTypes: piiMatches.map(m => m.type)
      }
    });
  }

  /**
   * プロンプトインジェクション試行を記録
   */
  recordPromptInjectionAttempt(maskedInput: string, threats: string[]): void {
    this.incrementMetric('promptInjectionAttempts');
    
    this.recordAuditLog({
      event: 'PROMPT_INJECTION_ATTEMPT',
      maskedInput,
      rejectionReason: 'プロンプトインジェクション攻撃を検出',
      fallbackOccurred: false,
      metadata: {
        threatCount: threats.length,
        threats: threats.slice(0, 5) // 最初の5つの脅威のみ記録
      }
    });
  }

  /**
   * スキーマ検証失敗を記録
   */
  recordSchemaValidationFailure(maskedInput: string, errors: string[]): void {
    this.incrementMetric('schemaValidationFailures');
    
    this.recordAuditLog({
      event: 'SCHEMA_VALIDATION_FAILURE',
      maskedInput,
      schemaValidationError: errors.join('; '),
      fallbackOccurred: true,
      metadata: {
        errorCount: errors.length
      }
    });
  }

  /**
   * リトライを記録
   */
  recordRetry(attempt: number, error: string): void {
    this.incrementMetric('retryCount');
    
    this.recordAuditLog({
      event: 'RETRY_ATTEMPT',
      maskedInput: '[MASKED]',
      fallbackOccurred: false,
      metadata: {
        attempt,
        error: error.substring(0, 100) // エラーメッセージを100文字に制限
      }
    });
  }

  /**
   * キャンセルを記録
   */
  recordCancellation(): void {
    this.incrementMetric('cancellationCount');
    
    this.recordAuditLog({
      event: 'CANCELLATION',
      maskedInput: '[MASKED]',
      fallbackOccurred: false,
      metadata: {}
    });
  }

  /**
   * 成功を記録
   */
  recordSuccess(maskedInput: string, issues: Issue[], latency: number): void {
    this.recordMetric('latency', latency);
    
    this.recordAuditLog({
      event: 'SUCCESS',
      maskedInput,
      fallbackOccurred: false,
      metadata: {
        issueCount: issues.length,
        latency
      }
    });
  }

  /**
   * 指数バックオフでリトライ実行
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<{ success: boolean; data?: T; error?: string; attempts: number }> {
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      attempts = attempt + 1;

      try {
        const data = await operation();
        return { success: true, data, attempts };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('不明なエラー');
        
        if (attempt < this.retryConfig.maxRetries) {
          this.recordRetry(attempt + 1, lastError.message);
          
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
          );
          
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'リトライ上限に達しました',
      attempts
    };
  }

  /**
   * 遅延
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * メトリクスを取得
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * 監査ログを取得
   */
  getAuditLogs(limit?: number): AuditLog[] {
    const logs = this.auditLogs;
    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * 特定のイベントのログを取得
   */
  getAuditLogsByEvent(event: string, limit?: number): AuditLog[] {
    const logs = this.auditLogs.filter(log => log.event === event);
    return limit ? logs.slice(-limit) : logs;
  }

  /**
   * メトリクスをリセット
   */
  resetMetrics(): void {
    this.metrics = {
      latency: 0,
      successRate: 0,
      rejectionCount: 0,
      schemaValidationFailures: 0,
      cancellationCount: 0,
      retryCount: 0,
      piiDetectionCount: 0,
      promptInjectionAttempts: 0
    };
  }

  /**
   * 監査ログをクリア
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * 設定を更新
   */
  updateConfig(config: {
    retryConfig?: Partial<RetryConfig>;
    maxLogs?: number;
  }): void {
    if (config.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...config.retryConfig };
    }
    if (config.maxLogs !== undefined) {
      this.maxLogs = config.maxLogs;
    }
  }

  /**
   * ヘルスチェック
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Metrics;
    recentErrors: number;
  } {
    const recentLogs = this.getAuditLogs(100);
    const recentErrors = recentLogs.filter(log => 
      log.event.includes('FAILURE') || log.event.includes('ERROR')
    ).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (recentErrors > 10) {
      status = 'unhealthy';
    } else if (recentErrors > 5 || this.metrics.successRate < 90) {
      status = 'degraded';
    }

    return {
      status,
      metrics: this.getMetrics(),
      recentErrors
    };
  }
}

/**
 * シングルトンインスタンス
 */
export const observabilityManager = new ObservabilityManager();
