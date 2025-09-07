import { useAppStore, useFilteredIssues, useSelectedIssue as useSelectedIssueFromStore } from './store';
import { 
  useAnalysisActions, 
  useRuleActions, 
  useSettingsActions, 
  useIssueActions, 
  useTextActions, 
  useUIActions 
} from './actions';

/**
 * アプリケーション全体の状態とアクションを取得するフック
 */
export const useApp = () => {
  const state = useAppStore();
  const analysisActions = useAnalysisActions();
  const ruleActions = useRuleActions();
  const settingsActions = useSettingsActions();
  const issueActions = useIssueActions();
  const textActions = useTextActions();
  const uiActions = useUIActions();

  return {
    ...state,
    ...analysisActions,
    ...ruleActions,
    ...settingsActions,
    ...issueActions,
    ...textActions,
    ...uiActions
  };
};

/**
 * フィルタリングされた問題を取得するフック
 */
export const useIssues = () => {
  const filteredIssues = useFilteredIssues();
  const { issueStats, issueFilters } = useAppStore();
  const issueActions = useIssueActions();

  return {
    issues: filteredIssues,
    stats: issueStats,
    filters: issueFilters,
    ...issueActions
  };
};

/**
 * 選択された問題を取得するフック
 */
export const useSelectedIssue = () => {
  const selectedIssue = useSelectedIssueFromStore();
  const { selectIssueById, applySuggestionToIssue, dismissIssueById } = useIssueActions();

  return {
    issue: selectedIssue,
    selectIssue: selectIssueById,
    applySuggestion: applySuggestionToIssue,
    dismissIssue: dismissIssueById
  };
};

/**
 * テキスト編集関連のフック
 */
export const useTextEditor = () => {
  const { text, selectedTextRange, isAnalyzing } = useAppStore();
  const textActions = useTextActions();
  const analysisActions = useAnalysisActions();

  return {
    text,
    selectedRange: selectedTextRange,
    isAnalyzing,
    ...textActions,
    ...analysisActions
  };
};

/**
 * 設定管理のフック
 */
export const useSettings = () => {
  const { settings, isSettingsOpen } = useAppStore();
  const settingsActions = useSettingsActions();
  const uiActions = useUIActions();

  return {
    settings,
    isOpen: isSettingsOpen,
    ...settingsActions,
    ...uiActions
  };
};

/**
 * ルール管理のフック
 */
export const useRules = () => {
  const { settings } = useAppStore();
  const ruleActions = useRuleActions();

  return {
    activeRuleset: settings.rules.activeRuleset,
    disabledRules: settings.rules.disabledRules,
    ...ruleActions
  };
};

/**
 * LLM設定のフック
 */
export const useLLM = () => {
  const { settings } = useAppStore();
  const { updateLLMSettings } = useSettingsActions();
  const { generateLLMSuggestions } = useAnalysisActions();

  return {
    settings: settings.llm,
    updateSettings: updateLLMSettings,
    generateSuggestions: generateLLMSuggestions
  };
};

/**
 * UI状態管理のフック
 */
export const useUI = () => {
  const { 
    isAnalyzing, 
    isSettingsOpen, 
    activeTab, 
    error 
  } = useAppStore();
  const uiActions = useUIActions();

  return {
    isAnalyzing,
    isSettingsOpen,
    activeTab,
    error,
    ...uiActions
  };
};

/**
 * 統計情報のフック
 */
export const useStats = () => {
  const { issueStats, issues } = useAppStore();
  const filteredIssues = useFilteredIssues();

  return {
    total: issueStats.total,
    filtered: filteredIssues.length,
    bySource: issueStats.bySource,
    bySeverity: issueStats.bySeverity,
    byCategory: issueStats.byCategory,
    allIssues: issues,
    filteredIssues
  };
};

/**
 * キーボードショートカット用のフック
 */
export const useKeyboardShortcuts = () => {
  const { analyzeText } = useAnalysisActions();
  const { applyAllAutoFixesToIssues } = useIssueActions();
  const { openSettings, closeSettings } = useUIActions();

  const handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl+Enter: 解析実行
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      analyzeText();
    }
    
    // Ctrl+Shift+A: 自動修正適用
    if (event.ctrlKey && event.shiftKey && event.key === 'A') {
      event.preventDefault();
      applyAllAutoFixesToIssues();
    }
    
    // Ctrl+,: 設定を開く
    if (event.ctrlKey && event.key === ',') {
      event.preventDefault();
      openSettings();
    }
    
    // Escape: 設定を閉じる
    if (event.key === 'Escape') {
      closeSettings();
    }
  };

  return {
    handleKeyDown
  };
};
