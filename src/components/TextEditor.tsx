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

  // フィルタリングされた問題を取得
  const filteredIssues = useMemo(() => {
    console.log('🔍 Debug - issues:', issues);
    console.log('🔍 Debug - filters:', filters);
    
    const filtered = issues.filter(issue => {
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
    
    console.log('🔍 Debug - filteredIssues:', filtered);
    return filtered;
  }, [issues, filters]);

  // ハイライト用のHTMLを生成（選択されたissueのみ表示）
  const highlightedHTML = useMemo(() => {
    console.log('🔍 Debug - filteredIssues:', filteredIssues);
    console.log('🔍 Debug - selectedIssue:', selectedIssue);
    console.log('🔍 Debug - text length:', text.length);

    // 選択されたissueがない場合は何もハイライトしない
    if (!selectedIssue) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    }

    // 重要度に応じたハイライトクラス
    const sevClass: Record<string, string> = {
      info: "bg-blue-100 border-b-2 border-blue-400",
      warn: "bg-yellow-100 border-b-2 border-yellow-500",
      error: "bg-red-100 border-b-2 border-red-500",
    };

    const highlightClass = `${sevClass[selectedIssue.severity]} rounded px-0.5`;

    let html = "";
    let i = 0;
    const start = selectedIssue.range.start;
    const end = selectedIssue.range.end;

    // 選択issue前のテキスト
    if (start > 0) {
      html += text.slice(0, start)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    }

    // 選択issueのハイライト部分
    const highlightedText = text.slice(start, end)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    html += `<span class="${highlightClass}" data-issue-id="${selectedIssue.id}">${highlightedText}</span>`;

    // 選択issue後のテキスト
    if (end < text.length) {
      html += text.slice(end)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    }

    return html;
  }, [text, selectedIssue]);


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
  }, [text]);

  // 初回レンダリング後にスクロール位置を同期
  useEffect(() => {
    syncScroll();
  }, []);

  // 選択されたissueが変更されたら、その位置へスクロール
  useEffect(() => {
    if (!selectedIssue || !editorRef.current || !overlayRef.current) return;

    // ハイライト要素を取得
    const highlightElement = overlayRef.current.querySelector(`[data-issue-id="${selectedIssue.id}"]`);
    if (!highlightElement) return;

    // 要素の位置を取得してスクロール
    const elementRect = highlightElement.getBoundingClientRect();
    const containerRect = overlayRef.current.getBoundingClientRect();

    // コンテナの中央に表示されるようにスクロール位置を計算
    const scrollTop = overlayRef.current.scrollTop +
      (elementRect.top - containerRect.top) -
      (containerRect.height / 2) +
      (elementRect.height / 2);

    // スムーズスクロール
    editorRef.current.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    });

    // オーバーレイも同期
    requestAnimationFrame(() => {
      if (overlayRef.current && editorRef.current) {
        overlayRef.current.scrollTop = editorRef.current.scrollTop;
      }
    });
  }, [selectedIssue]);

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
    const lineNumberWidth = 0; // 行番号なし
    
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


  return (
    <div className="relative">
      {/* ツールバー */}
      <div className="mb-2 flex items-center justify-end">
        <div className="text-xs text-slate-500" role="status" aria-live="polite">
          {text.length} 文字
        </div>
      </div>

      {/* エディターコンテナ */}
      <div className="relative h-[460px] rounded-xl border bg-white" role="textbox" aria-label="テキストエディター">
        {/* ハイライトオーバーレイ */}
        <div
          ref={overlayRef}
          aria-hidden
          className="absolute inset-0 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-6 text-transparent pointer-events-none"
          style={{ 
            tabSize: 4
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />

        {/* テキストエリア */}
        <textarea
          ref={editorRef}
          value={text}
          onChange={handleTextChange}
          onSelect={handleTextSelect}
          onClick={handleTextAreaClick}
          onScroll={syncScroll}
          className={`absolute inset-0 overflow-auto resize-none bg-transparent p-4 font-mono text-sm leading-6 caret-slate-900 text-slate-900 selection:bg-slate-200 ${getFocusIndicatorClasses()}`}
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
