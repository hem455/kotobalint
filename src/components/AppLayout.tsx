'use client';

import React, { useEffect, useRef } from 'react';
import { useApp, useKeyboardShortcuts } from '@/lib/hooks';
import { initializeStore } from '@/lib/store-utils';
import Header from './Header';
import TextEditor from './TextEditor';
import IssueList from './IssueList';
import VirtualizedIssueList from './VirtualizedIssueList';
import IssueDetail from './IssueDetail';
import Footer from './Footer';
import SettingsModal from './SettingsModal';

/**
 * メインアプリケーションレイアウト
 * Dialin AIスタイルのカードベースレイアウトを実装
 */
export default function AppLayout() {
  const { 
    isAnalyzing, 
    isSettingsOpen, 
    activeTab, 
    error,
    clearError 
  } = useApp();
  
  const { handleKeyDown } = useKeyboardShortcuts();

  // 初期化の重複実行を防ぐためのフラグ
  const isInitialized = useRef(false);

  // アプリケーション初期化
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    initializeStore();
  }, []);

  // キーボードショートカットの設定
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // エラーの自動クリア（5秒後）
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // ローディング時のスクロールロック
  useEffect(() => {
    if (isAnalyzing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // クリーンアップ時にスクロールを復元
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnalyzing]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* エラーバナー */}
      {error && (
        <div className="sticky top-0 z-50 bg-red-50 border-b border-red-200 px-4 py-3" role="alert">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
              aria-label="閉じる"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <Header />

      {/* メインコンテンツ */}
      <main className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-4">
        {/* テキストエディター */}
        <section className="col-span-6">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">エディター</h2>
              <span className="text-xs text-slate-500">等幅フォント・行番号・ハイライト表示</span>
            </div>
            <TextEditor />
          </div>
        </section>

        {/* 問題リスト */}
        <section className="col-span-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">問題一覧</h2>
            </div>
            <IssueList />
          </div>
        </section>

        {/* 問題詳細 */}
        <section className="col-span-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-slate-700">詳細</h2>
            </div>
            <IssueDetail />
          </div>
        </section>
      </main>

      {/* フッター */}
      <Footer />

      {/* ローディングオーバーレイ */}
      {isAnalyzing && (
        <div 
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="loading-spinner" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700" role="status" aria-live="polite">解析中...</span>
            </div>
          </div>
        </div>
      )}

      {/* 設定モーダル */}
      <SettingsModal />
    </div>
  );
}
