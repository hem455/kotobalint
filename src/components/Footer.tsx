'use client';

import React, { useMemo } from 'react';
import { useApp, useStats } from '@/lib/hooks';

/**
 * フッターコンポーネント
 * 統計情報とアプリケーション状態の表示
 */
export default function Footer() {
  const { settings, isAnalyzing } = useApp();
  const { total, filtered, bySeverity, bySource } = useStats();

  // テキスト統計を計算
  const { text } = useApp();
  const textStats = useMemo(() => {
    const sentences = text.split(/[。！？…]/).filter(s => s.trim().length > 0).length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const lines = text.split('\n').length;
    
    return {
      characters: text.length,
      sentences,
      words,
      lines
    };
  }, [text]);

  // 解析時間の表示（実際の実装では解析時間を追跡する必要があります）
  const analysisTime = useMemo(() => {
    // 実際の実装では解析時間を状態管理から取得
    return 0;
  }, []);

  return (
    <footer className="border-t bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          {/* 左側: テキスト統計 */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">文字数:</span>
              <span className="font-medium text-slate-800">{textStats.characters.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">文数:</span>
              <span className="font-medium text-slate-800">{textStats.sentences}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">単語数:</span>
              <span className="font-medium text-slate-800">{textStats.words}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">行数:</span>
              <span className="font-medium text-slate-800">{textStats.lines}</span>
            </div>
          </div>

          {/* 中央: 問題統計 */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">問題:</span>
              <span className="font-medium text-slate-800">
                {filtered} / {total}
              </span>
            </div>
            
            {bySeverity.error > 0 && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-red-600 font-medium">{bySeverity.error}</span>
                <span className="text-slate-500">エラー</span>
              </div>
            )}
            
            {bySeverity.warn > 0 && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-yellow-600 font-medium">{bySeverity.warn}</span>
                <span className="text-slate-500">警告</span>
              </div>
            )}
            
            {bySeverity.info > 0 && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-blue-600 font-medium">{bySeverity.info}</span>
                <span className="text-slate-500">情報</span>
              </div>
            )}
          </div>

          {/* 右側: システム情報 */}
          <div className="flex flex-wrap items-center gap-4">
            {/* 解析状態 */}
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="loading-spinner" />
                <span>解析中...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-slate-500">準備完了</span>
              </div>
            )}

            {/* 解析時間 */}
            {analysisTime > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">解析時間:</span>
                <span className="font-medium text-slate-800">{analysisTime}ms</span>
              </div>
            )}

            {/* ルールセット情報 */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500">ルールセット:</span>
              <span className="font-medium text-slate-800">
                {settings.rules.activeRuleset}
              </span>
            </div>

            {/* LLM状態 */}
            {settings.llm.enabled && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-slate-500">AI有効</span>
              </div>
            )}
          </div>
        </div>

        {/* ソース別統計 */}
        {(bySource.rule > 0 || bySource.llm > 0) && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>ソース別:</span>
              {bySource.rule > 0 && (
                <span>ルール: <span className="font-medium text-slate-700">{bySource.rule}</span></span>
              )}
              {bySource.llm > 0 && (
                <span>AI: <span className="font-medium text-slate-700">{bySource.llm}</span></span>
              )}
            </div>
          </div>
        )}

        {/* バージョン情報 */}
        <div className="mt-2 text-xs text-slate-400">
          <span>日本語校正アプリ v1.0.0</span>
          <span className="mx-2">·</span>
          <span>Powered by AI</span>
        </div>
      </div>
    </footer>
  );
}
