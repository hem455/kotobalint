'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useIssues, useSelectedIssue } from '@/lib/hooks';
import { IssueSeverity, IssueCategory, IssueSource } from '@/types';
import { 
  getSeverityAccessibilityInfo, 
  getCategoryAccessibilityInfo, 
  generateIssueDescription,
  generateIssueListDescription,
  getFocusIndicatorClasses,
  getAccessibleAnimationClasses
} from '@/lib/accessibility-utils';

interface VirtualizedIssueListProps {
  height?: number;
  itemHeight?: number;
}

/**
 * 仮想スクロール対応の問題リストコンポーネント
 * 大量の問題がある場合のパフォーマンス向上
 */
export default function VirtualizedIssueList({ 
  height = 400, 
  itemHeight = 80 
}: VirtualizedIssueListProps) {
  const {
    issues,
    stats,
    filters,
    filterIssuesBySource,
    filterIssuesBySeverity,
    filterIssuesByCategory,
    clearAllFilters
  } = useIssues();

  const { selectIssue, issue: selectedIssue } = useSelectedIssue();

  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // フィルタリングされた問題を取得
  const filteredIssues = useMemo(() => {
    if (!filters || !issues) return [];
    
    return issues.filter(issue => {
      if (filters.sources && filters.sources.length > 0 && !filters.sources.includes(issue.source)) {
        return false;
      }
      if (filters.severities && filters.severities.length > 0 && !filters.severities.includes(issue.severity)) {
        return false;
      }
      if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(issue.category)) {
        return false;
      }
      return true;
    });
  }, [issues, filters]);

  // 仮想スクロールの計算
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(height / itemHeight) + 1,
    filteredIssues.length
  );
  
  const visibleItems = filteredIssues.slice(visibleStart, visibleEnd);
  const totalHeight = filteredIssues.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  // スクロールハンドラー
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 問題選択ハンドラー
  const handleIssueSelect = useCallback((issueId: string) => {
    selectIssue(issueId);
  }, [selectIssue]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback((e: React.KeyboardEvent, issueId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleIssueSelect(issueId);
    }
  }, [handleIssueSelect]);

  // 重要度バッジコンポーネント
  const SeverityBadge = ({ severity }: { severity: IssueSeverity }) => {
    const { icon, label, className } = getSeverityAccessibilityInfo(severity);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}
        role="img"
        aria-label={label}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </span>
    );
  };

  // カテゴリタグコンポーネント
  const CategoryTag = ({ category }: { category: IssueCategory }) => {
    const { icon, label, className } = getCategoryAccessibilityInfo(category);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${className}`}
        role="img"
        aria-label={label}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </span>
    );
  };

  // 問題アイテムコンポーネント
  const IssueItem = ({ issue, index }: { issue: any; index: number }) => {
    const isSelected = selectedIssue?.id === issue.id;
    const actualIndex = visibleStart + index;

    return (
      <li
        key={issue.id}
        role="listitem"
        tabIndex={0}
        className={`p-3 border-b border-slate-200 cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${
          isSelected ? 'bg-blue-50 border-blue-200' : ''
        } ${getFocusIndicatorClasses()}`}
        onClick={() => handleIssueSelect(issue.id)}
        onKeyDown={(e) => handleKeyDown(e, issue.id)}
        aria-label={`問題 ${actualIndex + 1}: ${issue.message}`}
        aria-selected={isSelected}
        style={{ height: itemHeight }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={issue.severity} />
              <CategoryTag category={issue.category} />
              <span className="text-xs text-slate-500">
                {issue.range.start}-{issue.range.end}
              </span>
            </div>
            <p className="text-sm text-slate-900 line-clamp-2">
              {issue.message}
            </p>
            {issue.suggestions && issue.suggestions.length > 0 && (
              <p className="text-xs text-slate-600 mt-1">
                推奨: {issue.suggestions[0]}
              </p>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* フィルター */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap gap-2 mb-3">
          <div role="group" aria-label="ソースフィルター">
            <span className="text-xs font-medium text-slate-700 mb-1 block">ソース</span>
            <div className="flex gap-1">
              {(['rule', 'llm'] as IssueSource[]).map(source => (
                <button
                  key={source}
                  type="button"
                  onClick={() => filterIssuesBySource(source)}
                  className={`px-2 py-1 text-xs rounded border ${
                    filters.sources && filters.sources.includes(source)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  } ${getFocusIndicatorClasses()}`}
                  aria-pressed={filters.sources && filters.sources.includes(source)}
                >
                  {source === 'rule' ? 'ルール' : 'LLM'}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-label="重要度フィルター">
            <span className="text-xs font-medium text-slate-700 mb-1 block">重要度</span>
            <div className="flex gap-1">
              {(['info', 'warn', 'error'] as IssueSeverity[]).map(severity => (
                <button
                  key={severity}
                  type="button"
                  onClick={() => filterIssuesBySeverity(severity)}
                  className={`px-2 py-1 text-xs rounded border ${
                    filters.severities && filters.severities.includes(severity)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  } ${getFocusIndicatorClasses()}`}
                  aria-pressed={filters.severities && filters.severities.includes(severity)}
                >
                  {severity === 'info' ? '情報' : severity === 'warn' ? '警告' : 'エラー'}
                </button>
              ))}
            </div>
          </div>

          <div role="group" aria-label="カテゴリフィルター">
            <span className="text-xs font-medium text-slate-700 mb-1 block">カテゴリ</span>
            <div className="flex gap-1">
              {(['grammar', 'style', 'consistency', 'honorific', 'risk'] as IssueCategory[]).map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => filterIssuesByCategory(category)}
                  className={`px-2 py-1 text-xs rounded border ${
                    filters.categories && filters.categories.includes(category)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  } ${getFocusIndicatorClasses()}`}
                  aria-pressed={filters.categories && filters.categories.includes(category)}
                >
                  {category === 'grammar' ? '文法' : 
                   category === 'style' ? 'スタイル' :
                   category === 'consistency' ? '一貫性' :
                   category === 'honorific' ? '敬語' : 'リスク'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            フィルターをクリア
          </button>
          <div className="text-xs text-slate-600">
            {filteredIssues.length} / {issues.length} 件
          </div>
        </div>
      </div>

      {/* 問題リスト */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
        role="region"
        aria-label="問題リスト"
        aria-describedby="issue-list-description"
      >
        <div id="issue-list-description" className="sr-only">
          {generateIssueListDescription(filteredIssues, stats)}
        </div>
        
        <div style={{ height: totalHeight, position: 'relative' }}>
          <ul
            role="list"
            className="absolute top-0 left-0 right-0"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleItems.map((issue, index) => (
              <IssueItem key={issue.id} issue={issue} index={index} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
