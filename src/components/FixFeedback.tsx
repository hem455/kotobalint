'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

/**
 * 修正適用結果のフィードバック表示コンポーネント
 */
export default function FixFeedback() {
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    details?: any;
    timestamp: number;
  } | null>(null);

  const { applySuggestion, applyAllAutoFixes } = useAppStore();

  // フィードバックを表示
  const showFeedback = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    details?: any
  ) => {
    setFeedback({
      type,
      message,
      details,
      timestamp: Date.now()
    });

    // 5秒後に自動で非表示
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // 個別修正の結果を監視
  useEffect(() => {
    const originalApplySuggestion = applySuggestion;
    
    // 修正適用関数をラップ
    const wrappedApplySuggestion = (issueId: string, suggestionIndex: number) => {
      const result = originalApplySuggestion(issueId, suggestionIndex);
      
      if (result.success) {
        showFeedback('success', '修正を適用しました', {
          appliedText: result.appliedText,
          originalText: result.originalText
        });
      } else {
        showFeedback('error', result.error || '修正の適用に失敗しました');
      }
      
      return result;
    };

    // 関数を置き換え（実際の実装では、ストアの関数を直接ラップする必要があります）
  }, [applySuggestion]);

  // 一括修正の結果を監視
  useEffect(() => {
    const originalApplyAllAutoFixes = applyAllAutoFixes;
    
    // 一括修正関数をラップ
    const wrappedApplyAllAutoFixes = () => {
      const result = originalApplyAllAutoFixes();
      
      if (result.success) {
        if (result.appliedCount > 0) {
          showFeedback('success', result.message, {
            appliedCount: result.appliedCount,
            failedCount: result.failedCount,
            appliedFixes: result.appliedFixes,
            failedFixes: result.failedFixes
          });
        } else {
          showFeedback('info', result.message);
        }
      } else {
        showFeedback('error', '一括修正に失敗しました');
      }
      
      return result;
    };
  }, [applyAllAutoFixes]);

  if (!feedback) return null;

  const getFeedbackStyles = () => {
    switch (feedback.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (feedback.type) {
      case 'success':
        return (
          <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.725-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md">
      <div className={`rounded-lg border p-4 shadow-lg ${getFeedbackStyles()}`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium">
              {feedback.message}
            </p>
            {feedback.details && (
              <div className="mt-2 text-xs opacity-75">
                {feedback.type === 'success' && feedback.details.appliedCount && (
                  <div>
                    <p>適用件数: {feedback.details.appliedCount}</p>
                    {feedback.details.failedCount > 0 && (
                      <p>失敗件数: {feedback.details.failedCount}</p>
                    )}
                  </div>
                )}
                {feedback.type === 'success' && feedback.details.appliedText && (
                  <div className="mt-1">
                    <p className="font-mono text-xs">
                      「{feedback.details.originalText}」→「{feedback.details.appliedText}」
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={() => setFeedback(null)}
              className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

