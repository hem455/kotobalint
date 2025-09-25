/**
 * パフォーマンス監視ユーティリティ
 * 解析時間、メモリ使用量、キャッシュ効率を監視
 */

export interface PerformanceMetrics {
  analysisTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  ruleCount: number;
  issueCount: number;
  textLength: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // 最大保持件数

  /**
   * 解析開始時のタイムスタンプを記録
   */
  startAnalysis(): number {
    return performance.now();
  }

  /**
   * 解析完了時のメトリクスを記録
   */
  endAnalysis(
    startTime: number,
    ruleCount: number,
    issueCount: number,
    textLength: number,
    cacheStats?: { rules: number; regex: number }
  ): PerformanceMetrics {
    const analysisTime = performance.now() - startTime;
    const memoryUsage = this.getMemoryUsage();
    const cacheHitRate = this.calculateCacheHitRate(cacheStats);

    const metric: PerformanceMetrics = {
      analysisTime,
      memoryUsage,
      cacheHitRate,
      ruleCount,
      issueCount,
      textLength
    };

    this.addMetric(metric);
    return metric;
  }

  /**
   * メモリ使用量を取得
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / 1024 / 1024; // MB単位
    }
    return 0;
  }

  /**
   * キャッシュヒット率を計算
   */
  private calculateCacheHitRate(cacheStats?: { 
    hits: number; 
    misses: number; 
    rules?: number; 
    regex?: number 
  }): number {
    if (!cacheStats || !('hits' in cacheStats) || !('misses' in cacheStats)) return 0;
    const totalAccess = cacheStats.hits + cacheStats.misses;
    return totalAccess > 0 ? cacheStats.hits / totalAccess : 0;
  }
  /**
   * メトリクスを追加
   */
  private addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // 最大件数を超えた場合は古いものを削除
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 平均解析時間を取得
   */
  getAverageAnalysisTime(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.analysisTime, 0);
    return total / this.metrics.length;
  }

  /**
   * パフォーマンス要件の達成状況をチェック
   */
  checkPerformanceRequirements(): {
    meets2000Chars5Sec: boolean;
    averageTime: number;
    maxTime: number;
  } {
    const recentMetrics = this.metrics.filter(m => m.textLength >= 2000);
    const averageTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.analysisTime, 0) / recentMetrics.length
      : 0;
    const maxTime = recentMetrics.length > 0
      ? Math.max(...recentMetrics.map(m => m.analysisTime))
      : 0;

    return {
      meets2000Chars5Sec: maxTime <= 5000, // 5秒以内
      averageTime,
      maxTime
    };
  }

  /**
   * メトリクスを取得
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * メトリクスをクリア
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * パフォーマンスレポートを生成
   */
  generateReport(): string {
    const recent = this.metrics.slice(-10); // 直近10件
    if (recent.length === 0) {
      return 'パフォーマンスデータがありません';
    }

    const avgTime = recent.reduce((sum, m) => sum + m.analysisTime, 0) / recent.length;
    const avgMemory = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
    const avgCacheHit = recent.reduce((sum, m) => sum + m.cacheHitRate, 0) / recent.length;

    return `
パフォーマンスレポート (直近${recent.length}件):
- 平均解析時間: ${avgTime.toFixed(2)}ms
- 平均メモリ使用量: ${avgMemory.toFixed(2)}MB
- 平均キャッシュヒット率: ${(avgCacheHit * 100).toFixed(1)}%
- 総解析回数: ${this.metrics.length}
    `.trim();
  }
}

// グローバルインスタンス
export const performanceMonitor = new PerformanceMonitor();
