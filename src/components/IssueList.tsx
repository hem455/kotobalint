'use client';

import React, { useMemo, memo, useRef, useEffect } from 'react';
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
import { SkeletonIssueList } from '@/components/ui/Skeleton';
import { useAppStore } from '@/lib/store';

/**
 * 問題リストコンポーネント
 * 問題の種別・重要度・カテゴリ別表示とフィルタリング機能
 */
const IssueList = memo(function IssueList() {
  const {
    issues: filteredIssues,
    stats,
    filters,
    filterIssuesBySource,
    filterIssuesBySeverity,
    filterIssuesByCategory,
    clearAllFilters
  } = useIssues();

  const { selectIssue, issue: selectedIssue } = useSelectedIssue();
  const { isAnalyzing } = useAppStore();
  const selectedIssueRef = useRef<HTMLLIElement>(null);

  // 選択されたissueへ自動スクロール
  useEffect(() => {
    if (selectedIssue && selectedIssueRef.current) {
      selectedIssueRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selectedIssue]);

  // 重要度バッジコンポーネント
  const SeverityBadge = ({ severity }: { severity: IssueSeverity }) => {
    const severityInfo = getSeverityAccessibilityInfo(severity);
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severityInfo.colorClass}`}
        role="img"
        aria-label={severityInfo.ariaLabel}
      >
        <span aria-hidden="true">{severityInfo.icon}</span>
        <span className="ml-1">{severityInfo.label}</span>
      </span>
    );
  };

  // カテゴリタグコンポーネント
  const CategoryTag = ({ category }: { category: IssueCategory }) => {
    const categoryInfo = getCategoryAccessibilityInfo(category);
    return (
      <span 
        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        role="img"
        aria-label={categoryInfo.ariaLabel}
        title={categoryInfo.description}
      >
        {categoryInfo.label}
      </span>
    );
  };

  // ソースフィルター
  const SourceFilter = () => (
    <div className="flex gap-2" role="group" aria-label="ソースフィルター">
      {(['all', 'rule', 'llm'] as const).map((source) => {
        const isSelected = (filters.source?.length === 0 && source === 'all') || 
          (filters.source?.includes(source as IssueSource));
        const sourceLabel = source === 'all' ? 'すべて' : source === 'rule' ? 'ルール' : 'AI';
        
        return (
          <button
            key={source}
            onClick={() => filterIssuesBySource(source === 'all' ? [] : [source])}
            className={`rounded-full px-3 py-1 text-sm border ${getFocusIndicatorClasses()} ${
              isSelected
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            aria-pressed={isSelected}
            aria-label={`${sourceLabel}でフィルター${isSelected ? '（選択中）' : ''}`}
          >
            {sourceLabel}
          </button>
        );
      })}
    </div>
  );

  // 重要度フィルター
  const SeverityFilter = () => (
    <div className="flex flex-wrap gap-2" role="group" aria-label="重要度フィルター">
      {(['info', 'warn', 'error'] as IssueSeverity[]).map((severity) => {
        const isChecked = filters.severity?.includes(severity) || false;
        const severityInfo = getSeverityAccessibilityInfo(severity);
        
        return (
          <label key={severity} className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                const current = new Set(filters.severity || []);
                if (e.target.checked) {
                  current.add(severity);
                } else {
                  current.delete(severity);
                }
                filterIssuesBySeverity(Array.from(current));
              }}
              className={`rounded border-gray-300 text-blue-600 ${getFocusIndicatorClasses()}`}
              aria-describedby={`severity-${severity}-description`}
            />
            <SeverityBadge severity={severity} />
            <span id={`severity-${severity}-description`} className="sr-only">
              {severityInfo.ariaLabel}でフィルター{isChecked ? '（選択中）' : ''}
            </span>
          </label>
        );
      })}
    </div>
  );

  // カテゴリフィルター
  const CategoryFilter = () => {
    const categories: IssueCategory[] = ['style', 'grammar', 'honorific', 'consistency', 'risk'];
    
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label="カテゴリフィルター">
        {categories.map((category) => {
          const isChecked = filters.category?.includes(category) || false;
          const categoryInfo = getCategoryAccessibilityInfo(category);
          
          return (
            <label key={category} className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  const current = new Set(filters.category || []);
                  if (e.target.checked) {
                    current.add(category);
                  } else {
                    current.delete(category);
                  }
                  filterIssuesByCategory(Array.from(current));
                }}
                className={`rounded border-gray-300 text-blue-600 ${getFocusIndicatorClasses()}`}
                aria-describedby={`category-${category}-description`}
              />
              <CategoryTag category={category} />
              <span id={`category-${category}-description`} className="sr-only">
                {categoryInfo.ariaLabel}でフィルター{isChecked ? '（選択中）' : ''}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  // フィルターが適用されているかチェック
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.source && filters.source.length > 0) ||
      (filters.severity && filters.severity.length > 0) ||
      (filters.category && filters.category.length > 0)
    );
  }, [filters]);

  // 問題リストの説明文を生成
  const issueListDescription = useMemo(() => {
    return generateIssueListDescription(filteredIssues, filters);
  }, [filteredIssues, filters]);

  return (
    <div className="space-y-3">
      {/* フィルター */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">フィルター</span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className={`text-xs text-blue-600 hover:text-blue-800 ${getFocusIndicatorClasses()}`}
              aria-label="すべてのフィルターをクリア"
            >
              クリア
            </button>
          )}
        </div>
        
        <div className="space-y-2">
          <div>
            <div className="mb-1 text-xs text-slate-500">ソース</div>
            <SourceFilter />
          </div>
          
          <div>
            <div className="mb-1 text-xs text-slate-500">重要度</div>
            <SeverityFilter />
          </div>
          
          <div>
            <div className="mb-1 text-xs text-slate-500">カテゴリ</div>
            <CategoryFilter />
          </div>
        </div>
      </div>

      {/* 統計情報 */}
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="text-xs font-medium text-slate-600 mb-2">統計</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-500">総数:</span>
            <span className="ml-1 font-medium text-slate-800">{stats.total}</span>
          </div>
          <div>
            <span className="text-slate-500">表示:</span>
            <span className="ml-1 font-medium text-slate-800">{filteredIssues.length}</span>
          </div>
          <div>
            <span className="text-slate-500">エラー:</span>
            <span className="ml-1 font-medium text-red-600">{stats.bySeverity.error || 0}</span>
          </div>
          <div>
            <span className="text-slate-500">警告:</span>
            <span className="ml-1 font-medium text-yellow-600">{stats.bySeverity.warn || 0}</span>
          </div>
        </div>
      </div>

      {/* 問題リスト */}
      <div
        className="max-h-[400px] overflow-auto"
        role="region"
        aria-label="問題リスト"
        aria-describedby="issue-list-description"
      >
        <div id="issue-list-description" className="sr-only">
          {issueListDescription}
        </div>
        {isAnalyzing ? (
          <SkeletonIssueList count={5} />
        ) : filteredIssues.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            {stats.total === 0 ? '問題はありません。解析を実行してください。' : 'フィルターに一致する問題がありません。'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" role="list">
            {filteredIssues.map((issue, index) => {
              const isSelected = selectedIssue?.id === issue.id;
              const issueDescription = generateIssueDescription(issue);
              
              return (
                <li
                  key={issue.id}
                  ref={isSelected ? selectedIssueRef : null}
                  className={`cursor-pointer px-2 py-3 transition-all duration-200 ${getAccessibleAnimationClasses()} ${
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-blue-600 shadow-sm'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                  onClick={() => selectIssue(issue.id)}
                  tabIndex={0}
                  aria-label={issueDescription}
                  aria-current={isSelected ? 'true' : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectIssue(issue.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">
                        {issue.message}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {issue.source === 'rule' ? 'ルール' : 'AI'} · 
                        {issue.range.start}–{issue.range.end}
                        {issue.ruleVersion && ` · ${issue.ruleVersion}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <SeverityBadge severity={issue.severity} />
                      <CategoryTag category={issue.category} />
                    </div>
                  </div>
                  
                  {/* 提案がある場合のインジケーター */}
                  {issue.suggestions && issue.suggestions.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                      </svg>
                      <span>{issue.suggestions.length} 件の修正案</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
});

export default IssueList;
