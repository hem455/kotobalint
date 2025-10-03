'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/lib/hooks';
import { getKeyboardNavigationManager } from '@/lib/keyboard-navigation';
import { getFocusIndicatorClasses, getAccessibleAnimationClasses } from '@/lib/accessibility-utils';

/**
 * ヘッダーコンポーネント
 * 解析ボタンと設定アクセスを配置
 */
export default function Header() {
  const {
    text,
    analyzeText,
    generateLLMSuggestions,
    applyAllAutoFixesToIssues,
    openSettings,
    updateSettings,
    settings,
    isAnalyzing
  } = useApp();

  const headerRef = useRef<HTMLElement>(null);

  const handleAnalyze = useCallback(() => {
    console.log('解析ボタンがクリックされました');
    analyzeText();
  }, [analyzeText]);

  const handleLLMSuggestions = useCallback(() => {
    console.log('[DEBUG] AI提案ボタンクリック - text length:', text?.length || 0);
    console.log('[DEBUG] text preview:', text?.slice(0, 100) || '(empty)');
    generateLLMSuggestions('business');
  }, [text, generateLLMSuggestions]);

  const handleFixAll = useCallback(() => {
    applyAllAutoFixesToIssues();
  }, [applyAllAutoFixesToIssues]);

  const handleSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const handleModeChange = useCallback((mode: 'llm' | 'rules') => {
    updateSettings({
      analysis: {
        ...settings.analysis,
        mode
      }
    });
  }, [updateSettings, settings]);

  const handlePresetChange = useCallback((preset: 'light' | 'standard' | 'strict') => {
    updateSettings({
      analysis: {
        ...settings.analysis,
        preset
      }
    });
  }, [updateSettings, settings]);

  // キーボードナビゲーションの設定
  useEffect(() => {
    const navigationManager = getKeyboardNavigationManager();
    
    // キーボードショートカットを登録
    navigationManager.registerShortcut({
      key: 'Enter',
      ctrlKey: true,
      description: '解析実行',
      action: handleAnalyze
    });

    navigationManager.registerShortcut({
      key: 's',
      ctrlKey: true,
      description: '設定を開く',
      action: handleSettings
    });

    // フォーカス可能な要素を登録
    if (headerRef.current) {
      const focusableElements = Array.from(
        headerRef.current.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')
      ) as HTMLElement[];
      navigationManager.registerFocusableElements(focusableElements);
    }
  }, [handleAnalyze, handleSettings]);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-10 border-b bg-white/80 backdrop-blur ${getAccessibleAnimationClasses()}`}
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4">
        {/* 1段目: ロゴとタイトル + 設定 */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-xl bg-slate-900 flex items-center justify-center"
              role="img"
              aria-label="校正アプリのロゴ"
            >
              <span className="text-white text-sm font-bold">校</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">kotobalint</h1>
              <p className="text-xs text-slate-500">AI-powered Japanese proofreading</p>
            </div>
          </div>

          {/* 設定ボタン */}
          <button
            type="button"
            onClick={handleSettings}
            className={`btn-ghost flex items-center gap-2 ${getFocusIndicatorClasses()}`}
            aria-label="設定を開く (Ctrl+S)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>設定</span>
            <span className="text-xs opacity-75">(Ctrl+S)</span>
          </button>
        </div>

        {/* 2段目: コントロールとアクション */}
        <div className="flex items-center justify-between py-2.5">
          {/* 左側: モード選択 + プリセット */}
          <div className="flex items-center gap-3">
            {/* モードタブ */}
            <div
              className="inline-flex rounded-lg bg-slate-100 p-1"
              role="tablist"
              aria-label="解析モード選択"
            >
              <button
                type="button"
                role="tab"
                aria-selected={settings?.analysis?.mode === 'llm'}
                onClick={() => handleModeChange('llm')}
                className={`
                  px-4 py-1.5 text-sm font-medium rounded-md transition-all
                  ${settings?.analysis?.mode === 'llm'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                  ${getFocusIndicatorClasses()}
                `}
              >
                LLM
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={settings?.analysis?.mode === 'rules'}
                onClick={() => handleModeChange('rules')}
                className={`
                  px-4 py-1.5 text-sm font-medium rounded-md transition-all
                  ${settings?.analysis?.mode === 'rules'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                  ${getFocusIndicatorClasses()}
                `}
              >
                ルールベース
              </button>
            </div>

            {/* プリセット選択（ルールベースモード時のみ） */}
            {settings?.analysis?.mode === 'rules' && (
              <select
                id="preset-select"
                value={settings?.analysis?.preset || 'standard'}
                onChange={(e) => handlePresetChange(e.target.value as 'light' | 'standard' | 'strict')}
                className={`rounded-lg border-slate-200 bg-white px-3 py-1.5 text-sm ${getFocusIndicatorClasses()}`}
                aria-label="プリセット選択"
              >
                <option value="light">Light (高速)</option>
                <option value="standard">Standard (推奨)</option>
                <option value="strict">Strict (厳格)</option>
              </select>
            )}
          </div>

          {/* 右側: アクションボタン */}
          <div className="flex items-center gap-2">
            {/* LLMモード: AI提案ボタン */}
            {settings?.analysis?.mode === 'llm' ? (
              <button
                type="button"
                onClick={handleLLMSuggestions}
                disabled={isAnalyzing}
                className={`btn-primary flex items-center gap-2 ${getFocusIndicatorClasses()}`}
                aria-label="AI提案を生成"
              >
                {isAnalyzing ? (
                  <>
                    <div className="loading-spinner" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>AI提案</span>
                  </>
                )}
              </button>
            ) : (
              /* ルールベースモード: 解析実行ボタン */
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={`btn-primary flex items-center gap-2 ${getFocusIndicatorClasses()}`}
                aria-label="解析実行 (Ctrl+Enter)"
              >
                {isAnalyzing ? (
                  <>
                    <div className="loading-spinner" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>解析実行</span>
                  </>
                )}
              </button>
            )}

            {/* 一括修正ボタン */}
            <button
              type="button"
              onClick={handleFixAll}
              disabled={isAnalyzing}
              className={`btn-secondary flex items-center gap-2 ${getFocusIndicatorClasses()}`}
              aria-label="すべての問題を一括修正"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>一括修正</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
