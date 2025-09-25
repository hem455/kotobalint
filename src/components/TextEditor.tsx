'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useTextEditor, useIssues, useSelectedIssue } from '@/lib/hooks';
import { getFocusIndicatorClasses, getAccessibleAnimationClasses } from '@/lib/accessibility-utils';
import { useDebouncedAnalysis } from '@/lib/performance-utils';

/**
 * テキストエディターコンポーネント
 * 等幅フォント、行番号付きテキストエリア、問題ハイライト表示機能
 */
export default function TextEditor() {
  const {
    text,
    selectedRange,
    isAnalyzing,
    updateText,
    selectTextRange,
    analyzeText
  } = useTextEditor();

  // デバウンス解析を設定（自動解析が有効な場合のみ）
  const debouncedAnalyze = useDebouncedAnalysis(
    text,
    analyzeText,
    500, // 500ms遅延
    true // 自動解析有効
  );

  // 初期テキストを設定（デモ用）
  useEffect(() => {
    if (!text || text.trim() === '') {
      const initialText = "これはテスト用の文章です。コンピュータとコンピューターの表記ゆれがあります。また、ら抜き言葉の「食べれる」も含まれています。";
      updateText(initialText);
    }
  }, [updateText, text]);

  const { issues, filters } = useIssues();
  const { issue: selectedIssue } = useSelectedIssue();

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  // フィルタリングされた問題を取得
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (filters.source && filters.source.length > 0) {
        if (!filters.source.includes(issue.source)) return false;
      }
      if (filters.severity && filters.severity.length > 0) {
        if (!filters.severity.includes(issue.severity)) return false;
      }
      if (filters.category && filters.category.length > 0) {
        if (!filters.category.includes(issue.category)) return false;
      }
      return true;
    });
  }, [issues, filters]);

  // ハイライト用のHTMLを生成
  const highlightedHTML = useMemo(() => {
    const strength: Record<string, number> = { info: 1, warn: 2, error: 3 };
    const cover: (string | null)[] = new Array(text.length).fill(null);

    // 問題の範囲をカバレッジ配列にマーク
    filteredIssues.forEach(issue => {
      const safeStart = Math.max(issue.range.start, 0);
      const safeEnd = Math.min(Math.max(issue.range.end, 0), text.length);
      
      if (safeStart < safeEnd) {
        for (let p = safeStart; p < safeEnd; p++) {
          const cur = cover[p];
          if (!cur || strength[issue.severity] > strength[cur]) {
            cover[p] = issue.severity;
          }
        }
      }
    });

    const sevClass: Record<string, string> = {
      info: "underline decoration-2 decoration-blue-400 underline-offset-2",
      warn: "underline decoration-2 decoration-yellow-500 underline-offset-2",
      error: "underline decoration-2 decoration-red-500 underline-offset-2",
    };

    // 選択された問題のハイライトクラス
    const selectedClass = "bg-yellow-200 ring-2 ring-yellow-400 ring-opacity-50";

    let html = "";
    let i = 0;
    while (i < text.length) {
      const sev = cover[i];
      let j = i + 1;
      while (j < text.length && cover[j] === sev) j++;
      
      const chunk = text.slice(i, j)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      
      // 選択された問題の範囲かチェック（重複検出）
      const isSelected = selectedIssue && 
        i >= selectedIssue.range.start && 
        j <= selectedIssue.range.end;

      if (sev) {
        const classes = isSelected ? `${sevClass[sev]} ${selectedClass}` : sevClass[sev];
        html += `<span class="${classes} pointer-events-auto" data-issue-range="${i}-${j}">${chunk}</span>`;
      } else {
        const classes = isSelected ? selectedClass : "";
        html += classes ? `<span class="${classes} pointer-events-auto">${chunk}</span>` : chunk;
      }
      i = j;
    }
    return html;
  }, [text, filteredIssues, selectedIssue]);

  // 行番号を生成
  const lineNumbers = useMemo(() => {
    const lines = text.split('\n');
    return lines.map((_, index) => index + 1);
  }, [text]);

  // スクロール同期（改良版）
  const syncScroll = () => {
    if (!editorRef.current || !overlayRef.current) return;
    
    // より確実な同期のため、直接設定
    overlayRef.current.scrollTop = editorRef.current.scrollTop;
    overlayRef.current.scrollLeft = editorRef.current.scrollLeft;
    
    // さらに、requestAnimationFrameでも同期を確実にする
    requestAnimationFrame(() => {
      if (!editorRef.current || !overlayRef.current) return;
      overlayRef.current.scrollTop = editorRef.current.scrollTop;
      overlayRef.current.scrollLeft = editorRef.current.scrollLeft;
    });
  };

  // テキスト更新後にも一度同期（折返し再計算でスクロール量が変わることがある）
  useEffect(() => {
    syncScroll();
  }, [text, showLineNumbers]);

  // スクロールイベントのリスナーを追加（リアルタイム同期）
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleScroll = () => {
      syncScroll();
    };

    editor.addEventListener('scroll', handleScroll);
    return () => editor.removeEventListener('scroll', handleScroll);
  }, []);

  // テキスト変更ハンドラー
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateText(e.target.value);
    // デバウンス解析を実行
    debouncedAnalyze();
  };

  // テキスト選択ハンドラー
  const handleTextSelect = () => {
    if (!editorRef.current) return;
    const { selectionStart, selectionEnd } = editorRef.current;
    if (selectionStart !== selectionEnd) {
      selectTextRange({ start: selectionStart, end: selectionEnd });
    } else {
      selectTextRange(null);
    }
  };

  // ハイライトクリックハンドラー（改良版）
  const handleHighlightClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // オーバーレイのクリックイベントを停止
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    const spanElement = target.closest('[data-issue-range]') as HTMLElement;
    if (spanElement) {
      const rangeAttr = spanElement.getAttribute('data-issue-range');
      if (rangeAttr) {
        const [start, end] = rangeAttr.split('-').map(Number);
        selectTextRange({ start, end });
        editorRef.current?.focus();
      }
    }
  };

  // テキストエリアでのクリックイベント処理
  const handleTextAreaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    // クリック位置から問題の範囲を特定
    const textarea = e.currentTarget;
    const rect = textarea.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // クリック位置の文字位置を計算（簡易版）
    const lineHeight = 24; // leading-6 = 1.5rem = 24px
    const charWidth = 8; // 概算
    const padding = 16; // p-4 = 1rem = 16px
    const lineNumberWidth = showLineNumbers ? 64 : 0; // pl-16 = 4rem = 64px
    
    const lineIndex = Math.floor((clickY - padding) / lineHeight);
    const charIndex = Math.floor((clickX - padding - lineNumberWidth) / charWidth);
    
    // テキスト内の実際の位置を計算
    const lines = text.split('\n');
    let textPosition = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) {
      textPosition += lines[i].length + 1; // +1 for newline
    }
    textPosition += Math.min(charIndex, lines[lineIndex]?.length || 0);
    
    // 該当する問題を検索
    const clickedIssue = filteredIssues.find(issue => 
      textPosition >= issue.range.start && textPosition <= issue.range.end
    );
    
    if (clickedIssue) {
      selectTextRange(clickedIssue.range);
    }
  };

  // 行番号の表示/非表示切り替え
  const toggleLineNumbers = () => {
    setShowLineNumbers(!showLineNumbers);
  };

  return (
    <div className="relative">
      {/* ツールバー */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={toggleLineNumbers}
              className={`rounded border-gray-300 text-blue-600 ${getFocusIndicatorClasses()}`}
              aria-describedby="line-numbers-description"
            />
            <span id="line-numbers-description">行番号</span>
          </label>
        </div>
        <div className="text-xs text-slate-500" role="status" aria-live="polite">
          {text.length} 文字
        </div>
      </div>

      {/* エディターコンテナ */}
      <div className="relative h-[460px] overflow-auto rounded-xl border bg-white" role="textbox" aria-label="テキストエディター">
        {/* 行番号 */}
        {showLineNumbers && (
          <div className="absolute left-0 top-0 z-10 h-full w-12 bg-slate-50 border-r border-slate-200" aria-hidden="true">
            <div className="p-4 font-mono text-xs text-slate-500 leading-6">
              {lineNumbers.map(num => (
                <div key={num} className="h-6 text-right">
                  {num}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ハイライトオーバーレイ */}
        <div
          ref={overlayRef}
          aria-hidden
          className={`absolute inset-0 whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-transparent ${
            showLineNumbers ? 'pl-16' : ''
          }`}
          style={{ 
            tabSize: 4,
            pointerEvents: 'none' // デフォルトでは無効
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
          onClick={handleHighlightClick}
        />

        {/* テキストエリア */}
        <textarea
          ref={editorRef}
          value={text}
          onChange={handleTextChange}
          onSelect={handleTextSelect}
          onClick={handleTextAreaClick}
          className={`absolute inset-0 resize-none bg-transparent p-4 font-mono text-sm leading-6 caret-slate-900 text-slate-900 selection:bg-slate-200 ${getFocusIndicatorClasses()} ${
            showLineNumbers ? 'pl-16' : ''
          }`}
          style={{ 
            tabSize: 4
          }}
          spellCheck={false}
          placeholder="ここにテキストを入力してください..."
          aria-label="テキストエディター"
          aria-describedby="text-editor-description"
        />
        <div id="text-editor-description" className="sr-only">
          テキストを入力してください。問題がある箇所は色付きの下線で表示されます。
        </div>
      </div>

      {/* 選択範囲の情報 */}
      {selectedRange && (
        <div className="mt-2 text-xs text-slate-500" role="status" aria-live="polite">
          選択範囲: {selectedRange.start} - {selectedRange.end} 
          ({selectedRange.end - selectedRange.start} 文字)
        </div>
      )}
    </div>
  );
}
