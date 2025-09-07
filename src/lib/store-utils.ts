import { useAppStore } from './store';
import { apiClient } from './api-client';

/**
 * ストアの初期化処理
 */
export const initializeStore = async () => {
  try {
    // 設定をサーバーから読み込み
    const serverSettings = await apiClient.getSettings();
    useAppStore.getState().updateSettings(serverSettings);
  } catch (error) {
    console.warn('Failed to load settings from server, using local settings:', error);
    // サーバーから設定を読み込めない場合はローカル設定を使用
  }
};

/**
 * ストアのヘルスチェック
 */
export const checkStoreHealth = async () => {
  try {
    const health = await apiClient.healthCheck();
    return {
      isHealthy: health.overall,
      services: health,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      isHealthy: false,
      services: {
        lint: false,
        suggest: false,
        overall: false
      },
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * ストアの状態をエクスポート
 */
export const exportStoreState = () => {
  const state = useAppStore.getState();
  return {
    text: state.text,
    issues: state.issues,
    settings: state.settings,
    issueFilters: state.issueFilters,
    timestamp: new Date().toISOString()
  };
};

/**
 * ストアの状態をインポート
 */
export const importStoreState = (data: {
  text?: string;
  issues?: any[];
  settings?: any;
  issueFilters?: any;
}) => {
  const { setText, setIssues, updateSettings, setIssueFilters } = useAppStore.getState();
  
  if (data.text !== undefined) {
    setText(data.text);
  }
  
  if (data.issues !== undefined) {
    setIssues(data.issues);
  }
  
  if (data.settings !== undefined) {
    updateSettings(data.settings);
  }
  
  if (data.issueFilters !== undefined) {
    setIssueFilters(data.issueFilters);
  }
};

/**
 * ストアの状態をリセット
 */
export const resetStore = () => {
  useAppStore.getState().clearAll();
};

/**
 * デバッグ用のストア情報を取得
 */
export const getStoreDebugInfo = () => {
  const state = useAppStore.getState();
  return {
    textLength: state.text.length,
    issuesCount: state.issues.length,
    selectedIssueId: state.selectedIssueId,
    isAnalyzing: state.isAnalyzing,
    isSettingsOpen: state.isSettingsOpen,
    activeTab: state.activeTab,
    hasError: !!state.error,
    settings: {
      analysisTrigger: state.settings.analysis.trigger,
      llmEnabled: state.settings.llm.enabled,
      activeRuleset: state.settings.rules.activeRuleset,
      disabledRulesCount: state.settings.rules.disabledRules.length
    },
    stats: state.issueStats
  };
};

/**
 * ストアの状態を検証
 */
export const validateStoreState = () => {
  const state = useAppStore.getState();
  const errors: string[] = [];
  
  // テキストの検証
  if (typeof state.text !== 'string') {
    errors.push('Text must be a string');
  }
  
  // 問題の検証
  if (!Array.isArray(state.issues)) {
    errors.push('Issues must be an array');
  } else {
    state.issues.forEach((issue, index) => {
      if (!issue.id || typeof issue.id !== 'string') {
        errors.push(`Issue ${index} must have a valid id`);
      }
      if (!issue.range || typeof issue.range.start !== 'number' || typeof issue.range.end !== 'number') {
        errors.push(`Issue ${index} must have a valid range`);
      }
    });
  }
  
  // 設定の検証
  if (!state.settings || typeof state.settings !== 'object') {
    errors.push('Settings must be an object');
  }
  
  // フィルターの検証
  if (!state.issueFilters || typeof state.issueFilters !== 'object') {
    errors.push('Issue filters must be an object');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * ストアのパフォーマンス監視
 */
export const monitorStorePerformance = () => {
  const startTime = performance.now();
  
  // ストアの状態を取得
  const state = useAppStore.getState();
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  return {
    duration,
    isSlow: duration > 10, // 10ms以上は遅いとみなす
    timestamp: new Date().toISOString()
  };
};
