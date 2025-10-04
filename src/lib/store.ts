import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Issue,
  AppSettings,
  IssueFilters,
  IssueStats,
  TextRange,
  ContentStyle,
  IssueSeverity,
  IssueCategory,
  IssueSource
} from '@/types';
import type { LlmProvider, LlmModel } from '@/types/llm';
import { AVAILABLE_MODELS } from '@/types/llm';

// 履歴管理用のインターフェース
export interface TextHistory {
  text: string;
  issues: Issue[];
  timestamp: number;
  action: string; // 'edit' | 'apply_fix' | 'bulk_fix' | 'clear'
  description?: string;
}

// アプリケーションの状態インターフェース
interface AppState {
  // テキスト関連
  text: string;
  selectedTextRange: TextRange | null;
  
  // 問題関連
  issues: Issue[];
  selectedIssueId: string | null;
  issueFilters: IssueFilters;
  issueStats: IssueStats;
  
  // 設定関連
  settings: AppSettings;
  
  // UI状態
  isAnalyzing: boolean;
  isSettingsOpen: boolean;
  activeTab: 'text' | 'issues' | 'settings';
  
  // エラー状態
  error: string | null;
  
  // 履歴管理
  history: TextHistory[];
  historyIndex: number;
  maxHistorySize: number;
}

type AutoFixAppliedEntry = {
  issueId: string;
  originalText: string;
  appliedText: string;
  range: { start: number; end: number };
};

type AutoFixFailureEntry = {
  issueId: string;
  error: string;
};

interface AutoFixSummary {
  success: boolean;
  appliedCount: number;
  failedCount: number;
  appliedFixes: AutoFixAppliedEntry[];
  failedFixes: AutoFixFailureEntry[];
  message: string;
}

// アクションインターフェース
interface AppActions {
  // テキスト関連アクション
  setText: (text: string) => void;
  setSelectedTextRange: (range: TextRange | null) => void;
  
  // 問題関連アクション
  setIssues: (issues: Issue[]) => void;
  addIssues: (issues: Issue[]) => void;
  clearIssues: () => void;
  selectIssue: (issueId: string | null) => void;
  applySuggestion: (issueId: string, suggestionIndex: number) => void;
  dismissIssue: (issueId: string) => void;
  
  // フィルタリング関連アクション
  setIssueFilters: (filters: Partial<IssueFilters>) => void;
  clearFilters: () => void;
  updateIssueStats: () => void;
  
  // 設定関連アクション
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // UI状態アクション
  setAnalyzing: (isAnalyzing: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'text' | 'issues' | 'settings') => void;
  
  // エラー処理
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 一括操作
  applyAllAutoFixes: () => AutoFixSummary;
  isSafeFix: (issue: Issue, suggestion: any) => boolean;
  
  // 履歴管理アクション
  saveToHistory: (action: string, description?: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  // その他
  clearAll: () => void;
}

// 環境変数から LLM 設定を読み込み（型に適合するようバリデーション）
const RAW_LLM_PROVIDER = process.env.NEXT_PUBLIC_LLM_PROVIDER || 'gemini';
const ENV_LLM_PROVIDER: LlmProvider = RAW_LLM_PROVIDER === 'gemini' ? 'gemini' : 'gemini';

const RAW_LLM_MODEL = process.env.NEXT_PUBLIC_LLM_MODEL || 'gemini-2.5-flash';
const allowedModels = AVAILABLE_MODELS[ENV_LLM_PROVIDER] as readonly LlmModel[];
const ENV_LLM_MODEL: LlmModel = (allowedModels as readonly string[]).includes(RAW_LLM_MODEL)
  ? (RAW_LLM_MODEL as LlmModel)
  : 'gemini-2.5-flash';
const ENV_LLM_BASE_URL = process.env.NEXT_PUBLIC_LLM_BASE_URL || 'https://generativelanguage.googleapis.com';
const ENV_LLM_API_KEY = process.env.NEXT_PUBLIC_LLM_API_KEY || '';
const ENV_LLM_ENABLED = Boolean(ENV_LLM_API_KEY && ENV_LLM_BASE_URL);

// デフォルト設定
const defaultSettings: AppSettings = {
  analysis: {
    trigger: 'manual',
    autoDelay: 500,
    maxSentenceLength: 10000,
    mode: 'rules', // デフォルトをrulesに変更（LLM設定が不完全な場合のエラーを回避）
    preset: 'standard'
  },
  rules: {
    activeRuleset: 'japanese-standard',
    disabledRules: [],
    severityOverrides: {}
  },
  llm: {
    enabled: ENV_LLM_ENABLED,
    provider: ENV_LLM_PROVIDER,
    model: ENV_LLM_MODEL,
    baseUrl: ENV_LLM_BASE_URL,
    apiKey: ENV_LLM_API_KEY,
    timeoutMs: 30000,
    maxSuggestions: 3
  },
  ui: {
    theme: 'light',
    fontSize: 'medium',
    showLineNumbers: true,
    fontFamily: 'monospace'
  },
  privacy: {
    allowExternalRequests: false,
    logAnalytics: false
  }
};

// デフォルトフィルター
const defaultFilters: IssueFilters = {
  source: undefined,
  severity: undefined,
  category: undefined
};

// メインストア
export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => {
      // 現在のテキストを使って issue に元テキストを埋め込む
      const augmentIssuesWithContext = (incoming: Issue[]): Issue[] => {
        const currentText = get().text;

        return incoming.map(issue => {
          const { range } = issue;
          let originalText: string | undefined;

          if (
            range &&
            typeof range.start === 'number' &&
            typeof range.end === 'number' &&
            range.start >= 0 &&
            range.end <= currentText.length &&
            range.start < range.end
          ) {
            originalText = currentText.slice(range.start, range.end);
          }

          return {
            ...issue,
            metadata: {
              ...issue.metadata,
              originalText
            }
          };
        });
      };

      return {
        // 初期状態
        text: '',
        selectedTextRange: null,
        issues: [],
        selectedIssueId: null,
        issueFilters: defaultFilters,
        issueStats: {
          total: 0,
          bySource: {},
          bySeverity: {},
          byCategory: {}
        },
        settings: defaultSettings,
        isAnalyzing: false,
        isSettingsOpen: false,
        activeTab: 'text',
        error: ENV_LLM_ENABLED
          ? null
          : 'LLM設定が不完全です（APIキーまたはBase URLが未設定）。LLM機能を無効化しました。',
        history: [],
        historyIndex: -1,
        maxHistorySize: 50,

        // テキスト関連アクション
        setText: (text: string) => {
          const currentText = get().text;
          set({ text });
          // テキストが変更されたら選択範囲をクリア
          if (get().selectedTextRange) {
            set({ selectedTextRange: null });
          }
          // 統計情報を更新
          get().updateIssueStats();
          // テキストが実際に変更された場合のみ履歴に保存
          if (currentText !== text) {
            get().saveToHistory('edit', 'テキストを編集');
          }
        },

        setSelectedTextRange: (range: TextRange | null) => {
          set({ selectedTextRange: range });
        },

        // 問題関連アクション
        setIssues: (issues: Issue[]) => {
          const augmented = augmentIssuesWithContext(issues);
          set({ issues: augmented });
          get().updateIssueStats();
        },

      addIssues: (newIssues: Issue[]) => {
        const currentIssues = get().issues;
        const augmentedNewIssues = augmentIssuesWithContext(newIssues);
        const allIssues = [...currentIssues, ...augmentedNewIssues];
        set({ issues: allIssues });
        get().updateIssueStats();
      },

      clearIssues: () => {
        set({ 
          issues: [], 
          selectedIssueId: null,
          issueStats: {
            total: 0,
            bySource: {},
            bySeverity: {},
            byCategory: {}
          }
        });
      },

      selectIssue: (issueId: string | null) => {
        set({ selectedIssueId: issueId });
      },

      applySuggestion: (issueId: string, suggestionIndex: number) => {
        const { issues, text } = get();
        const issue = issues.find(i => i.id === issueId);
        
        if (!issue || !issue.suggestions || !issue.suggestions[suggestionIndex]) {
          console.warn('修正提案が見つかりません:', { issueId, suggestionIndex });
          return { success: false, error: '修正提案が見つかりません' };
        }

        // LLM 由来の提案は適用不可（プレビューのみ）
        if (issue.source === 'llm') {
          return { success: false, error: 'AI提案はプレビュー専用のため自動適用できません' };
        }

        const suggestion = issue.suggestions[suggestionIndex];

        // テキスト範囲の検証
        if (issue.range.start < 0 || issue.range.end > text.length || issue.range.start >= issue.range.end) {
          console.error('無効なテキスト範囲:', issue.range);
          return { success: false, error: '無効なテキスト範囲です' };
        }

        // 元のテキストの確認
        const currentSelection = text.slice(issue.range.start, issue.range.end);
        const expectedOriginal = typeof issue.metadata?.originalText === 'string'
          ? issue.metadata.originalText
          : currentSelection;

        if (currentSelection !== expectedOriginal) {
          console.warn('テキストが変更されています。範囲を再計算します。');
          // テキストが変更されている場合は、範囲を再計算する必要がある
          // ここでは簡易的に元のテキストで検索
          const newStart = expectedOriginal ? text.indexOf(expectedOriginal) : -1;
          if (newStart === -1) {
            return { success: false, error: '元のテキストが見つかりません' };
          }
          issue.range.start = newStart;
          issue.range.end = newStart + expectedOriginal.length;
          issue.metadata = {
            ...issue.metadata,
            originalText: expectedOriginal
          };
        }

        const originalText = text.slice(issue.range.start, issue.range.end);
        if (originalText !== expectedOriginal) {
          return { success: false, error: '元のテキストが一致しません' };
        }

        try {
          // テキストの置換
          const newText = text.slice(0, issue.range.start) + 
                         suggestion.text + 
                         text.slice(issue.range.end);

          // テキストを更新
          set({ text: newText });

          // 対象Issueは削除せず、適用した提案のみ除去して他の提案を保持
          const updatedIssues = issues.map(i => {
            if (i.id !== issueId) return i;
            const remainingSuggestions = (i.suggestions || []).filter((_, idx) => idx !== suggestionIndex);
            const newRangeEnd = i.range.start + suggestion.text.length;
            return {
              ...i,
              suggestions: remainingSuggestions,
              range: { start: i.range.start, end: newRangeEnd },
              start: i.range.start,
              end: newRangeEnd,
              metadata: {
                ...i.metadata,
                originalText: suggestion.text
              }
            };
          });

          const augmentedRemaining = augmentIssuesWithContext(updatedIssues);
          set({ issues: augmentedRemaining });
          get().updateIssueStats();

          // 成功ログ
          console.log('修正を適用しました:', {
            issueId,
            suggestionIndex,
            originalText,
            newText: suggestion.text,
            range: issue.range
          });

          return { 
            success: true, 
            appliedText: suggestion.text,
            originalText,
            range: issue.range
          };
        } catch (error) {
          console.error('修正適用エラー:', error);
          return { success: false, error: '修正の適用に失敗しました' };
        }
      },

      dismissIssue: (issueId: string) => {
        const { issues } = get();
        const updatedIssues = issues.filter(i => i.id !== issueId);
        set({ issues: updatedIssues });
        get().updateIssueStats();
      },

      // フィルタリング関連アクション
      setIssueFilters: (filters: Partial<IssueFilters>) => {
        const currentFilters = get().issueFilters;
        const newFilters = { ...currentFilters, ...filters };
        set({ issueFilters: newFilters });
      },

      clearFilters: () => {
        set({ issueFilters: defaultFilters });
      },

      updateIssueStats: () => {
        const { issues } = get();
        
        const stats: IssueStats = {
          total: issues.length,
          bySource: {},
          bySeverity: {},
          byCategory: {}
        };

        issues.forEach(issue => {
          // ソース別統計
          stats.bySource[issue.source] = (stats.bySource[issue.source] || 0) + 1;
          
          // 重要度別統計
          stats.bySeverity[issue.severity] = (stats.bySeverity[issue.severity] || 0) + 1;
          
          // カテゴリ別統計
          stats.byCategory[issue.category] = (stats.byCategory[issue.category] || 0) + 1;
        });

        set({ issueStats: stats });
      },

      // 設定関連アクション
      updateSettings: (newSettings: Partial<AppSettings>) => {
        const currentSettings = get().settings;
        const updatedSettings = {
          ...currentSettings,
          ...newSettings,
          analysis: { ...currentSettings.analysis, ...newSettings.analysis },
          rules: { ...currentSettings.rules, ...newSettings.rules },
          llm: {
            ...currentSettings.llm,
            ...newSettings.llm,
            enabled: Boolean(
              (newSettings.llm?.apiKey ?? currentSettings.llm.apiKey) &&
              (newSettings.llm?.baseUrl ?? currentSettings.llm.baseUrl)
            )
          },
          ui: { ...currentSettings.ui, ...newSettings.ui },
          privacy: { ...currentSettings.privacy, ...newSettings.privacy }
        };
        // 必須項目が欠けている場合はLLMを無効化しエラーを設定
        if (!updatedSettings.llm.enabled) {
          set({ settings: updatedSettings, error: 'LLM設定が不完全です（APIキーまたはBase URLが未設定）。LLM機能を無効化しました。' });
        } else {
          set({ settings: updatedSettings, error: null });
        }
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
      },

      // UI状態アクション
      setAnalyzing: (isAnalyzing: boolean) => {
        set({ isAnalyzing });
      },

      setSettingsOpen: (isOpen: boolean) => {
        set({ isSettingsOpen: isOpen });
      },

      setActiveTab: (tab: 'text' | 'issues' | 'settings') => {
        set({ activeTab: tab });
      },

      // エラー処理
      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      // 安全な一括修正機能
      applyAllAutoFixes: () => {
        const { issues, text, isSafeFix } = get();
        
        // autoFix=trueかつ安全な修正のみをフィルタリング
        const safeAutoFixIssues = issues.filter(issue => {
          // autoFixフラグの確認
          if (!issue.metadata?.autoFix) return false;

          // 提案が存在するか確認
          if (!issue.suggestions || issue.suggestions.length === 0) return false;

          // 安全な修正かどうか確認（意味変化リスクゼロ）
          const suggestion = issue.suggestions[0];
          if (!isSafeFix(issue, suggestion)) return false;

          // テキスト範囲の検証
          if (issue.range.start < 0 || issue.range.end > text.length || issue.range.start >= issue.range.end) {
            return false;
          }
          
          return true;
        });

        if (safeAutoFixIssues.length === 0) {
          return {
            success: true,
            appliedCount: 0,
            failedCount: 0,
            appliedFixes: [],
            failedFixes: [],
            message: '適用可能な安全な修正がありません'
          };
        }

        // 位置の降順でソート（後ろから修正して位置ずれを防ぐ）
        const sortedIssues = safeAutoFixIssues.sort((a, b) => b.range.start - a.range.start);

        let newText = text;
        const appliedFixes: Array<{
          issueId: string;
          originalText: string;
          appliedText: string;
          range: { start: number; end: number };
        }> = [];
        const failedFixes: Array<{
          issueId: string;
          error: string;
        }> = [];

        // 各修正を適用
        sortedIssues.forEach(issue => {
          try {
            const suggestion = issue.suggestions![0];
            const originalText = newText.slice(issue.range.start, issue.range.end);

            // 元のテキストが期待通りか確認
            const expectedOriginal = typeof issue.metadata?.originalText === 'string'
              ? issue.metadata.originalText
              : originalText;

            if (originalText !== expectedOriginal) {
              console.warn(`テキストが変更されています: ${issue.id}`);
              failedFixes.push({
                issueId: issue.id,
                error: 'テキストが変更されています'
              });
              return;
            }

            // テキストの置換
            newText = newText.slice(0, issue.range.start) + 
                     suggestion.text + 
                     newText.slice(issue.range.end);
            
            appliedFixes.push({
              issueId: issue.id,
              originalText,
              appliedText: suggestion.text,
              range: issue.range
            });
          } catch (error) {
            console.error(`修正適用エラー: ${issue.id}`, error);
            failedFixes.push({
              issueId: issue.id,
              error: error instanceof Error ? error.message : '不明なエラー'
            });
          }
        });

        // テキストと問題リストを更新
        const appliedIssueIds = appliedFixes.map(fix => fix.issueId);
        const remainingIssues = issues.filter(issue => !appliedIssueIds.includes(issue.id));
        const augmentedRemaining = augmentIssuesWithContext(remainingIssues);
        
        set({ 
          text: newText, 
          issues: augmentedRemaining 
        });
        get().updateIssueStats();

        return {
          success: true,
          appliedCount: appliedFixes.length,
          failedCount: failedFixes.length,
          appliedFixes,
          failedFixes,
          message: `${appliedFixes.length}件の修正を適用しました${failedFixes.length > 0 ? `（${failedFixes.length}件失敗）` : ''}`
        };
      },

      // 安全な修正かどうかを判定
      isSafeFix: (issue: Issue, suggestion: any): boolean => {
        // 基本的な安全チェック
        if (!suggestion || !suggestion.text) return false;

        // 意味変化リスクの低い修正のみを許可
        const safeCategories = ['consistency', 'style'];
        if (!safeCategories.includes(issue.category)) return false;

        // 重要度が低いもののみ
        if (issue.severity === 'error') return false;

        // 提案の信頼度が高いもののみ
        if (suggestion.confidence && suggestion.confidence < 0.8) return false;

        // 文字数が大きく変わらないもののみ（意味変化の可能性を下げる）
        if (typeof issue.metadata?.originalText !== 'string' || issue.metadata.originalText.trim().length === 0) {
          return false;
        }
        const originalLength = issue.metadata.originalText.length;
        const suggestionLength = suggestion.text.length;
        const lengthRatio = originalLength === 0
          ? 0
          : Math.abs(originalLength - suggestionLength) / originalLength;
        if (lengthRatio > 0.5) return false; // 50%以上の変化は許可しない

        return true;
      },

      // 履歴管理機能
      saveToHistory: (action: string, description?: string) => {
        const { text, issues, history, historyIndex, maxHistorySize } = get();
        
        const newHistoryEntry: TextHistory = {
          text,
          issues: [...issues],
          timestamp: Date.now(),
          action,
          description
        };

        // 現在の位置以降の履歴を削除（新しい履歴を追加するため）
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newHistoryEntry);

        // 履歴サイズ制限
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        } else {
          // 履歴を追加した場合はインデックスを進める
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        }
      },

      undo: () => {
        const { history, historyIndex } = get();
        
        if (historyIndex > 0) {
          const previousEntry = history[historyIndex - 1];
          set({
            text: previousEntry.text,
            issues: [...previousEntry.issues],
            historyIndex: historyIndex - 1
          });
          get().updateIssueStats();
          return true;
        }
        return false;
      },

      redo: () => {
        const { history, historyIndex } = get();
        
        if (historyIndex < history.length - 1) {
          const nextEntry = history[historyIndex + 1];
          set({
            text: nextEntry.text,
            issues: [...nextEntry.issues],
            historyIndex: historyIndex + 1
          });
          get().updateIssueStats();
          return true;
        }
        return false;
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      clearAll: () => {
        set({
          text: '',
          selectedTextRange: null,
          issues: [],
          selectedIssueId: null,
          issueFilters: defaultFilters,
          issueStats: {
            total: 0,
            bySource: {},
            bySeverity: {},
            byCategory: {}
          },
          error: null
        });
      }
      };
    },
    {
      name: 'japanese-proofreading-app-storage',
      storage: createJSONStorage(() => localStorage),
      // 設定のみを永続化（テキストと問題は一時的）
      partialize: (state) => ({
        settings: state.settings,
        issueFilters: state.issueFilters
      })
    }
  )
);

// フィルタリングされた問題を取得するセレクター
export const useFilteredIssues = () => {
  const { issues, issueFilters } = useAppStore();
  
  return issues.filter(issue => {
    // ソースフィルター
    if (issueFilters.source && issueFilters.source.length > 0) {
      if (!issueFilters.source.includes(issue.source)) {
        return false;
      }
    }
    
    // 重要度フィルター
    if (issueFilters.severity && issueFilters.severity.length > 0) {
      if (!issueFilters.severity.includes(issue.severity)) {
        return false;
      }
    }
    
    // カテゴリフィルター
    if (issueFilters.category && issueFilters.category.length > 0) {
      if (!issueFilters.category.includes(issue.category)) {
        return false;
      }
    }
    
    return true;
  });
};

// 選択された問題を取得するセレクター
export const useSelectedIssue = () => {
  const { issues, selectedIssueId } = useAppStore();
  return issues.find(issue => issue.id === selectedIssueId) || null;
};

// 設定の特定部分を取得するセレクター
export const useAnalysisSettings = () => useAppStore(state => state.settings.analysis);
export const useRuleSettings = () => useAppStore(state => state.settings.rules);
export const useLLMSettings = () => useAppStore(state => state.settings.llm);
export const useUISettings = () => useAppStore(state => state.settings.ui);
export const usePrivacySettings = () => useAppStore(state => state.settings.privacy);
