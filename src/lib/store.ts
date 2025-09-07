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
  applyAllAutoFixes: () => void;
  clearAll: () => void;
}

// デフォルト設定
const defaultSettings: AppSettings = {
  analysis: {
    trigger: 'manual',
    autoDelay: 500,
    maxSentenceLength: 200
  },
  rules: {
    activeRuleset: 'japanese-standard',
    disabledRules: [],
    severityOverrides: {}
  },
  llm: {
    enabled: false,
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    timeout: 10000,
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
    (set, get) => ({
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
      error: null,

      // テキスト関連アクション
      setText: (text: string) => {
        set({ text });
        // テキストが変更されたら選択範囲をクリア
        if (get().selectedTextRange) {
          set({ selectedTextRange: null });
        }
      },

      setSelectedTextRange: (range: TextRange | null) => {
        set({ selectedTextRange: range });
      },

      // 問題関連アクション
      setIssues: (issues: Issue[]) => {
        set({ issues });
        get().updateIssueStats();
      },

      addIssues: (newIssues: Issue[]) => {
        const currentIssues = get().issues;
        const allIssues = [...currentIssues, ...newIssues];
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
          return;
        }

        const suggestion = issue.suggestions[suggestionIndex];
        const newText = text.slice(0, issue.range.start) + 
                       suggestion.text + 
                       text.slice(issue.range.end);
        
        // テキストを更新
        set({ text: newText });
        
        // 該当する問題を削除
        const updatedIssues = issues.filter(i => i.id !== issueId);
        set({ issues: updatedIssues });
        get().updateIssueStats();
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
          llm: { ...currentSettings.llm, ...newSettings.llm },
          ui: { ...currentSettings.ui, ...newSettings.ui },
          privacy: { ...currentSettings.privacy, ...newSettings.privacy }
        };
        set({ settings: updatedSettings });
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

      // 一括操作
      applyAllAutoFixes: () => {
        const { issues, text } = get();
        const autoFixIssues = issues.filter(issue => 
          issue.metadata?.autoFix === true && issue.suggestions && issue.suggestions.length > 0
        );

        if (autoFixIssues.length === 0) {
          return;
        }

        // 位置の降順でソート（後ろから修正）
        const sortedIssues = autoFixIssues.sort((a, b) => b.range.start - a.range.start);
        
        let newText = text;
        const appliedIssueIds: string[] = [];

        sortedIssues.forEach(issue => {
          if (issue.suggestions && issue.suggestions[0]) {
            const suggestion = issue.suggestions[0];
            newText = newText.slice(0, issue.range.start) + 
                     suggestion.text + 
                     newText.slice(issue.range.end);
            appliedIssueIds.push(issue.id);
          }
        });

        // テキストと問題リストを更新
        const remainingIssues = issues.filter(issue => !appliedIssueIds.includes(issue.id));
        set({ 
          text: newText, 
          issues: remainingIssues 
        });
        get().updateIssueStats();
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
    }),
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
