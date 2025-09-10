/**
 * キーボードショートカット管理
 * 修正の取り消し・やり直し等のショートカットを提供
 */

import { useAppStore } from './store';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

/**
 * キーボードショートカットを設定
 */
export function setupKeyboardShortcuts() {
  const store = useAppStore.getState();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'z',
      ctrlKey: true,
      description: '修正を取り消す',
      action: () => {
        if (store.canUndo()) {
          store.undo();
        }
      }
    },
    {
      key: 'y',
      ctrlKey: true,
      description: '修正をやり直す',
      action: () => {
        if (store.canRedo()) {
          store.redo();
        }
      }
    },
    {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      description: '修正をやり直す（Ctrl+Shift+Z）',
      action: () => {
        if (store.canRedo()) {
          store.redo();
        }
      }
    },
    {
      key: 'Enter',
      ctrlKey: true,
      description: '解析を実行',
      action: () => {
        // 解析実行のロジック（既存の実装を使用）
        console.log('解析を実行');
      }
    },
    {
      key: 'a',
      ctrlKey: true,
      description: '安全な一括修正を実行',
      action: () => {
        store.applyAllAutoFixes();
      }
    },
    {
      key: 'Escape',
      description: '選択をクリア',
      action: () => {
        store.selectIssue(null);
        store.setSelectedTextRange(null);
      }
    }
  ];

  // キーボードイベントリスナーを設定
  const handleKeyDown = (event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find(shortcut => {
      return shortcut.key === event.key &&
             !!shortcut.ctrlKey === event.ctrlKey &&
             !!shortcut.shiftKey === event.shiftKey &&
             !!shortcut.altKey === event.altKey &&
             !!shortcut.metaKey === event.metaKey;
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
    }
  };

  // イベントリスナーを追加
  document.addEventListener('keydown', handleKeyDown);

  // クリーンアップ関数を返す
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * ショートカットの説明を取得
 */
export function getShortcutDescription(key: string, modifiers: {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}): string {
  const parts: string[] = [];
  
  if (modifiers.ctrlKey) parts.push('Ctrl');
  if (modifiers.shiftKey) parts.push('Shift');
  if (modifiers.altKey) parts.push('Alt');
  if (modifiers.metaKey) parts.push('Cmd');
  
  parts.push(key.toUpperCase());
  
  return parts.join('+');
}

/**
 * 利用可能なショートカット一覧を取得
 */
export function getAvailableShortcuts(): Array<{
  shortcut: string;
  description: string;
}> {
  return [
    {
      shortcut: 'Ctrl+Z',
      description: '修正を取り消す'
    },
    {
      shortcut: 'Ctrl+Y',
      description: '修正をやり直す'
    },
    {
      shortcut: 'Ctrl+Shift+Z',
      description: '修正をやり直す（代替）'
    },
    {
      shortcut: 'Ctrl+Enter',
      description: '解析を実行'
    },
    {
      shortcut: 'Ctrl+A',
      description: '安全な一括修正を実行'
    },
    {
      shortcut: 'Escape',
      description: '選択をクリア'
    }
  ];
}

