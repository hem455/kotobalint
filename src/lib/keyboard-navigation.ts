/**
 * キーボードナビゲーション機能
 * アクセシビリティ要件10.1に対応
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  action: () => void;
}

export class KeyboardNavigationManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = 0;

  constructor() {
    this.bindGlobalHandlers();
  }

  /**
   * キーボードショートカットを登録
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * フォーカス可能な要素を登録
   */
  registerFocusableElements(elements: HTMLElement[]): void {
    this.focusableElements = elements.filter(el => 
      el && !el.hidden && !this.isDisabled(el) && this.isFocusable(el)
    );
  }

  /**
   * 次の要素にフォーカス
   */
  focusNext(): void {
    if (this.focusableElements.length === 0) return;
    
    this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  /**
   * 前の要素にフォーカス
   */
  focusPrevious(): void {
    if (this.focusableElements.length === 0) return;
    
    this.currentFocusIndex = this.currentFocusIndex === 0 
      ? this.focusableElements.length - 1 
      : this.currentFocusIndex - 1;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  /**
   * 最初の要素にフォーカス
   */
  focusFirst(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = 0;
    this.focusableElements[0]?.focus();
  }

  /**
   * 最後の要素にフォーカス
   */
  focusLast(): void {
    if (this.focusableElements.length === 0) return;
    this.currentFocusIndex = this.focusableElements.length - 1;
    this.focusableElements[this.currentFocusIndex]?.focus();
  }

  /**
   * 特定の要素にフォーカス
   */
  focusElement(element: HTMLElement): void {
    const index = this.focusableElements.indexOf(element);
    if (index !== -1) {
      this.currentFocusIndex = index;
      element.focus();
    }
  }

  /**
   * グローバルキーハンドラーをバインド
   */
  private bindGlobalHandlers(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * キーダウンハンドラー
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // テキスト編集要素ではブラウザの標準動作を保持
    if (this.isTextEditableElement(event.target as HTMLElement)) {
      return;
    }

    // ショートカットキーの処理
    const shortcutKey = this.getShortcutKey({
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      description: '',
      action: () => {}
    });

    const shortcut = this.shortcuts.get(shortcutKey);
    if (shortcut) {
      event.preventDefault();
      shortcut.action();
      return;
    }

    // Tabキーでのナビゲーション
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        this.focusPrevious();
      } else {
        this.focusNext();
      }
    }

    // 矢印キーでのナビゲーション
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusNext();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusPrevious();
    }

    // Home/Endキー
    if (event.key === 'Home') {
      event.preventDefault();
      this.focusFirst();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.focusLast();
    }
  }

  /**
   * ショートカットキー文字列を生成
   */
  private getShortcutKey(shortcut: Partial<KeyboardShortcut>): string {
    const parts: string[] = [];
    if (shortcut.ctrlKey) parts.push('ctrl');
    if (shortcut.shiftKey) parts.push('shift');
    if (shortcut.altKey) parts.push('alt');
    parts.push(shortcut.key?.toLowerCase() || '');
    return parts.join('+');
  }

  /**
   * 要素がテキスト編集要素かチェック
   */
  private isTextEditableElement(element: HTMLElement | null): boolean {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    
    // contenteditable要素
    if (element.isContentEditable) {
      return true;
    }
    
    // textarea要素
    if (tagName === 'textarea') {
      return true;
    }
    
    // input要素（テキスト系）
    if (tagName === 'input') {
      const inputType = (element as HTMLInputElement).type?.toLowerCase();
      const textInputTypes = ['text', 'search', 'email', 'url', 'tel', 'password'];
      return textInputTypes.includes(inputType);
    }
    
    return false;
  }

  /**
   * 要素が無効化されているかチェック（型安全）
   */
  private isDisabled(element: HTMLElement): boolean {
    // フォームコントロール要素のみdisabledプロパティを持つ
    if (element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement) {
      return element.disabled;
    }
    
    // その他の要素は無効化されていないとみなす
    return false;
  }

  /**
   * 要素がフォーカス可能かチェック
   */
  private isFocusable(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const tabIndex = element.getAttribute('tabindex');
    
    // フォーカス可能な要素
    if (['input', 'button', 'select', 'textarea', 'a'].includes(tagName)) {
      return true;
    }
    
    // tabindexが設定されている要素
    if (tabIndex !== null && tabIndex !== '-1') {
      return true;
    }
    
    // クリック可能な要素
    if (element.onclick || element.getAttribute('role') === 'button') {
      return true;
    }
    
    return false;
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.shortcuts.clear();
    this.focusableElements = [];
  }
}

// デフォルトのキーボードショートカット（ブラウザ/OS標準と競合しない組み合わせ）
export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  {
    key: 'Enter',
    ctrlKey: true,
    description: '解析実行',
  },
  {
    key: 's',
    ctrlKey: true,
    shiftKey: true,
    description: '設定を開く',
  },
  {
    key: 'Escape',
    description: 'モーダルを閉じる',
  },
  {
    key: 'f',
    ctrlKey: true,
    shiftKey: true,
    description: 'フィルターにフォーカス',
  },
  {
    key: 'a',
    altKey: true,
    description: 'すべて選択',
  },
  {
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    description: '元に戻す',
  },
  {
    key: 'y',
    ctrlKey: true,
    shiftKey: true,
    description: 'やり直し',
  },
];

// シングルトンインスタンス
let navigationManager: KeyboardNavigationManager | null = null;

export function getKeyboardNavigationManager(): KeyboardNavigationManager {
  if (!navigationManager) {
    navigationManager = new KeyboardNavigationManager();
  }
  return navigationManager;
}

export function destroyKeyboardNavigationManager(): void {
  if (navigationManager) {
    navigationManager.destroy();
    navigationManager = null;
  }
}
