'use client';

import React, { memo } from 'react';
import { useSelectedIssue } from '@/lib/hooks';
import { IssueSeverity, IssueCategory } from '@/types';
import { 
  getSeverityAccessibilityInfo, 
  getCategoryAccessibilityInfo, 
  generateIssueDescription,
  getFocusIndicatorClasses,
  getAccessibleAnimationClasses
} from '@/lib/accessibility-utils';

/**
 * 問題詳細コンポーネント
 * 選択された問題の詳細情報表示と修正提案の適用機能
 */
const IssueDetail = memo(function IssueDetail() {
  const { issue: selectedIssue, applySuggestion, dismissIssue } = useSelectedIssue();

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

  // 修正案の適用
  const handleApplySuggestion = (suggestionIndex: number) => {
    if (!selectedIssue) return;
    if (selectedIssue.source === 'llm') {
      return; // LLM提案は適用不可（プレビューのみ）
    }
    applySuggestion(selectedIssue.id, suggestionIndex);
  };

  // 問題の無視
  const handleDismissIssue = () => {
    if (selectedIssue) {
      dismissIssue(selectedIssue.id);
    }
  };

  // 問題が選択されていない場合
  if (!selectedIssue) {
    return (
      <div className="py-6 text-center text-sm text-slate-500" role="status" aria-live="polite">
        <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>問題を選択して詳細を表示</p>
      </div>
    );
  }

  // 問題の詳細説明を生成
  const issueDescription = generateIssueDescription(selectedIssue);

  return (
    <div className="space-y-4" role="region" aria-label="問題詳細">
      {/* ヘッダー情報 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={selectedIssue.severity} />
          <CategoryTag category={selectedIssue.category} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismissIssue}
            className={`text-xs text-slate-500 hover:text-slate-700 ${getFocusIndicatorClasses()}`}
            title="この問題を無視"
            aria-label="この問題を無視"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 問題メッセージ */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">問題</div>
        <div className="text-sm text-slate-800 leading-relaxed" aria-describedby="issue-description">
          {selectedIssue.message}
        </div>
        <div id="issue-description" className="sr-only">
          {issueDescription}
        </div>
      </div>

      {/* 範囲情報 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">位置</div>
        <div className="text-sm font-mono text-slate-700 bg-slate-50 rounded px-2 py-1">
          {selectedIssue.range.start} - {selectedIssue.range.end} 
          ({selectedIssue.range.end - selectedIssue.range.start} 文字)
        </div>
      </div>

      {/* ソース情報 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1">ソース</div>
        <div className="text-sm text-slate-700">
          {selectedIssue.source === 'rule' ? 'ルールエンジン' : 'AI提案'}
          {selectedIssue.ruleVersion && (
            <span className="ml-2 text-xs text-slate-500">
              ({selectedIssue.ruleVersion})
            </span>
          )}
        </div>
      </div>

      {/* 修正提案 */}
      {selectedIssue.suggestions && selectedIssue.suggestions.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">
            修正案 ({selectedIssue.suggestions.length} 件)
          </div>
          <div className="space-y-2">
            {selectedIssue.suggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-3 bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-mono text-sm text-slate-800 bg-white rounded px-2 py-1 mb-2">
                      {suggestion.text}
                    </div>
                    {suggestion.rationale && (
                      <div className="text-xs text-slate-600">
                        {suggestion.rationale}
                      </div>
                    )}
                    {suggestion.confidence && (
                      <div className="text-xs text-slate-500 mt-1">
                        信頼度: {Math.round(suggestion.confidence * 100)}%
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {selectedIssue.source === 'rule' ? (
                      <button
                        onClick={() => handleApplySuggestion(index)}
                        className={`btn-primary text-xs px-3 py-1 ${getFocusIndicatorClasses()}`}
                        aria-label={`修正案${index + 1}を適用`}
                      >
                        適用
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500" aria-label="AI提案はプレビューのみ">プレビュー</span>
                    )}
                    {suggestion.isPreferred && (
                      <span className="text-xs text-green-600 font-medium" role="status" aria-label="推奨修正案">
                        推奨
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">修正案</div>
          <div className="text-sm text-slate-500 italic">
            自動修正案はありません。手動で編集してください。
          </div>
        </div>
      )}

      {/* メタデータ */}
      {selectedIssue.metadata && Object.keys(selectedIssue.metadata).length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1">詳細情報</div>
          <div className="text-xs text-slate-600 space-y-1">
            {Object.entries(selectedIssue.metadata).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="font-medium">{key}:</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex gap-2">
          {selectedIssue.suggestions && selectedIssue.suggestions.length > 0 && selectedIssue.source === 'rule' && (
            <button
              onClick={() => handleApplySuggestion(0)}
              className={`btn-primary text-sm px-4 py-2 flex-1 ${getFocusIndicatorClasses()}`}
              aria-label="最初の修正案を適用"
            >
              最初の修正案を適用
            </button>
          )}
          <button
            onClick={handleDismissIssue}
            className={`btn-secondary text-sm px-4 py-2 ${getFocusIndicatorClasses()}`}
            aria-label="この問題を無視"
          >
            無視
          </button>
        </div>
      </div>
    </div>
  );
});

export default IssueDetail;
