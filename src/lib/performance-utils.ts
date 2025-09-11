import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * デバウンス解析用のフック
 * 入力停止から指定時間後に解析を実行する
 */
export function useDebouncedAnalysis(
  text: string,
  analyzeText: () => void,
  delay: number = 500,
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTextRef = useRef<string>(text);

  const debouncedAnalyze = useCallback(() => {
    if (!enabled || text === lastTextRef.current) {
      return;
    }

    // 既存のタイムアウトをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 新しいタイムアウトを設定
    timeoutRef.current = setTimeout(() => {
      if (text !== lastTextRef.current) {
        lastTextRef.current = text;
        analyzeText();
      }
    }, delay);
  }, [text, analyzeText, delay, enabled]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedAnalyze;
}

/**
 * メモ化された問題フィルタリング
 * 問題リストが大きい場合のパフォーマンス向上
 */
export function useMemoizedIssueFiltering(
  issues: any[],
  filters: any
) {
  return useCallback(() => {
    if (!issues || issues.length === 0) {
      return [];
    }

    return issues.filter(issue => {
      // ソースフィルタ
      if (filters.sources.length > 0 && !filters.sources.includes(issue.source)) {
        return false;
      }

      // 重要度フィルタ
      if (filters.severities.length > 0 && !filters.severities.includes(issue.severity)) {
        return false;
      }

      // カテゴリフィルタ
      if (filters.categories.length > 0 && !filters.categories.includes(issue.category)) {
        return false;
      }

      return true;
    });
  }, [issues, filters]);
}

/**
 * 仮想スクロール用のアイテム計算
 */
export function useVirtualScroll(
  items: any[],
  containerHeight: number,
  itemHeight: number = 60
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );
  
  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  };
}

/**
 * パフォーマンス監視用のフック
 */
export function usePerformanceMonitor() {
  const measureTime = useCallback((name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  }, []);

  const measureAsync = useCallback(async (name: string, fn: () => Promise<any>) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
    return result;
  }, []);

  return { measureTime, measureAsync };
}

/**
 * メモリ使用量の監視
 */
export function useMemoryMonitor() {
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }, []);

  const logMemoryUsage = useCallback((label: string) => {
    const memory = getMemoryUsage();
    if (memory) {
      console.log(`${label} - Memory: ${(memory.used / 1024 / 1024).toFixed(2)}MB / ${(memory.total / 1024 / 1024).toFixed(2)}MB`);
    }
  }, [getMemoryUsage]);

  return { getMemoryUsage, logMemoryUsage };
}
