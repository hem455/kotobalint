'use client';

import React, { useMemo } from 'react';
import { useIssues, useSelectedIssue } from '@/lib/hooks';
import { IssueSeverity, IssueCategory, IssueSource } from '@/types';

/**
 * 問題リストコンポーネント
 * 問題の種別・重要度・カテゴリ別表示とフィルタリング機能
 */
export default function IssueList() {
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

  // 重要度バッジコンポーネント
  const SeverityBadge = ({ severity }: { severity: IssueSeverity }) => (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        severity === 'error'
          ? 'bg-red-100 text-red-800'
          : severity === 'warn'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-blue-100 text-blue-800'
      }`}
    >
      {severity === 'error' ? 'エラー' : severity === 'warn' ? '警告' : '情報'}
    </span>
  );

  // カテゴリタグコンポーネント
  const CategoryTag = ({ category }: { category: IssueCategory }) => {
    const categoryLabels: Record<IssueCategory, string> = {
      style: 'スタイル',
      grammar: '文法',
      honorific: '敬語',
      consistency: '一貫性',
      risk: 'リスク'
    };

    return (
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        {categoryLabels[category]}
      </span>
    );
  };

  // ソースフィルター
  const SourceFilter = () => (
    <div className="flex gap-2">
      {(['all', 'rule', 'llm'] as const).map((source) => (
        <button
          key={source}
          onClick={() => filterIssuesBySource(source === 'all' ? [] : [source])}
          className={`rounded-full px-3 py-1 text-sm border ${
            (filters.source?.length === 0 && source === 'all') || 
            (filters.source?.includes(source as IssueSource))
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {source === 'all' ? 'すべて' : source === 'rule' ? 'ルール' : 'AI'}
        </button>
      ))}
    </div>
  );

  // 重要度フィルター
  const SeverityFilter = () => (
    <div className="flex flex-wrap gap-2">
      {(['info', 'warn', 'error'] as IssueSeverity[]).map((severity) => (
        <label key={severity} className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={filters.severity?.includes(severity) || false}
            onChange={(e) => {
              const current = new Set(filters.severity || []);
              if (e.target.checked) {
                current.add(severity);
              } else {
                current.delete(severity);
              }
              filterIssuesBySeverity(Array.from(current));
            }}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <SeverityBadge severity={severity} />
        </label>
      ))}
    </div>
  );

  // カテゴリフィルター
  const CategoryFilter = () => {
    const categories: IssueCategory[] = ['style', 'grammar', 'honorific', 'consistency', 'risk'];
    
    return (
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <label key={category} className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={filters.category?.includes(category) || false}
              onChange={(e) => {
                const current = new Set(filters.category || []);
                if (e.target.checked) {
                  current.add(category);
                } else {
                  current.delete(category);
                }
                filterIssuesByCategory(Array.from(current));
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <CategoryTag category={category} />
          </label>
        ))}
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

  return (
    <div className="space-y-3">
      {/* フィルター */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">フィルター</span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-blue-600 hover:text-blue-800"
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
            <span className="ml-1 font-medium text-slate-800">{issues.length}</span>
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
      <div className="max-h-[400px] overflow-auto">
        {issues.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            {stats.total === 0 ? '問題はありません。解析を実行してください。' : 'フィルターに一致する問題がありません。'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className={`cursor-pointer px-2 py-3 hover:bg-slate-50 transition-colors ${
                  selectedIssue?.id === issue.id ? 'bg-slate-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => selectIssue(issue.id)}
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
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                    </svg>
                    <span>{issue.suggestions.length} 件の修正案</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
