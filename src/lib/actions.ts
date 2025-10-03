import { useAppStore } from './store';
import { apiClient, generateSuggestionsForText } from './api-client';
import type { LintRequest, ContentStyle, IssueSource, IssueSeverity, IssueCategory } from '@/types';

/**
 * テキスト解析アクション
 */
export const useAnalysisActions = () => {
  const {
    setIssues,
    setAnalyzing,
    setError,
    clearError,
    settings,
    text
  } = useAppStore();

  const analyzeText = async (textToAnalyze?: string) => {
    console.log('analyzeText関数が呼び出されました');
    const targetText = textToAnalyze || text;
    
    if (!targetText.trim()) {
      console.log('テキストが空です');
      setError('解析するテキストがありません');
      return;
    }

    // 機密性配慮: 生テキストは出力しない
    // ログ方針: 長さと先頭プレビュー(最大50文字、改行除去)のみを、
    // settings.privacy.logAnalytics が有効な場合に限り出力する
    const previewLength = Math.min(50, targetText.length);
    const preview = targetText.slice(0, previewLength).replace(/\n/g, ' ');
    const redactedInfo = `[len=${targetText.length}] preview="${preview}${targetText.length > previewLength ? '…' : ''}"`;
    if (useAppStore.getState().settings.privacy.logAnalytics) {
      console.log('解析を開始します:', redactedInfo, 'mode:', settings.analysis.mode);
    }
    setAnalyzing(true);
    clearError();

    try {
      // モードに応じて分岐
      if (settings.analysis.mode === 'rules') {
        // ルールベース解析（プリセット使用）
        const response = await apiClient.analyzeTextRules({
          text: targetText,
          preset: settings.analysis.preset
        });
        
        // デバッグ: 返された issues を確認
        console.log('[analyzeText] Rules mode - API response:', {
          issuesCount: response.issues.length,
          preset: settings.analysis.preset,
          textLength: targetText.length
        });
        
        response.issues.forEach((issue, idx) => {
          console.log(`[analyzeText] Issue #${idx + 1}:`, {
            id: issue.id,
            range: issue.range,
            message: issue.message,
            matchedText: targetText.slice(issue.range.start, issue.range.end),
            source: issue.source
          });
        });
        
        setIssues(response.issues);
      } else {
        // LLMモード（従来の /api/lint）
        const request: LintRequest = {
          text: targetText,
          ruleset: settings.rules.activeRuleset,
          options: {
            maxIssues: 100,
            includeSuggestions: true,
            timeout: 10000
          }
        };

        const response = await apiClient.lintText(request);
        // 既存のLLM由来の問題は保持し、ルールベース結果で上書きしない
        const existingIssues = useAppStore.getState().issues || [];
        const llmIssues = existingIssues.filter((i) => i.source === 'llm');
        // ルールベース結果（source!== 'llm' とみなす）を優先
        const merged = [...response.issues, ...llmIssues];
        setIssues(merged);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '解析中にエラーが発生しました';
      setError(errorMessage);
      console.error('Text analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const generateLLMSuggestions = async (style: ContentStyle = 'business') => {
    if (!text.trim()) {
      setError('LLM提案を生成するテキストがありません');
      return;
    }

    if (!settings.llm.enabled) {
      setError('LLM機能が無効になっています');
      return;
    }

    setAnalyzing(true);
    clearError();

    try {
      const response = await generateSuggestionsForText(text, style);
      
      // 既存の問題に追加
      const { addIssues } = useAppStore.getState();
      addIssues(response.issues);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'LLM提案生成中にエラーが発生しました';
      setError(errorMessage);
      console.error('LLM suggestions error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzeText,
    generateLLMSuggestions
  };
};

/**
 * ルール管理アクション
 */
export const useRuleActions = () => {
  const { updateSettings, settings } = useAppStore();

  const switchRuleSet = async (ruleSetId: string) => {
    try {
      await apiClient.switchRuleSet(ruleSetId);
      updateSettings({
        rules: {
          ...settings.rules,
          activeRuleset: ruleSetId
        }
      });
    } catch (error) {
      console.error('Rule set switch error:', error);
      throw error;
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await apiClient.toggleRule(ruleId, enabled);
      
      const currentDisabledRules = settings.rules.disabledRules;
      const newDisabledRules = enabled
        ? currentDisabledRules.filter(id => id !== ruleId)
        : [...currentDisabledRules, ruleId];
      
      updateSettings({
        rules: {
          ...settings.rules,
          disabledRules: newDisabledRules
        }
      });
    } catch (error) {
      console.error('Rule toggle error:', error);
      throw error;
    }
  };

  return {
    switchRuleSet,
    toggleRule
  };
};

/**
 * 設定管理アクション
 */
export const useSettingsActions = () => {
  const { updateSettings, settings } = useAppStore();

  const loadSettings = async () => {
    try {
      const serverSettings = await apiClient.getSettings();
      updateSettings(serverSettings);
    } catch (error) {
      console.error('Settings load error:', error);
      // サーバーから設定を読み込めない場合はローカル設定を使用
    }
  };

  const saveSettings = async (newSettings: Partial<typeof settings>) => {
    try {
      await apiClient.saveSettings(newSettings);
      updateSettings(newSettings);
    } catch (error) {
      console.error('Settings save error:', error);
      throw error;
    }
  };

  const updateAnalysisSettings = (analysisSettings: Partial<typeof settings.analysis>) => {
    updateSettings({
      analysis: {
        ...settings.analysis,
        ...analysisSettings
      }
    });
  };

  const updateRuleSettings = (ruleSettings: Partial<typeof settings.rules>) => {
    updateSettings({
      rules: {
        ...settings.rules,
        ...ruleSettings
      }
    });
  };

  const updateLLMSettings = (llmSettings: Partial<typeof settings.llm>) => {
    updateSettings({
      llm: {
        ...settings.llm,
        ...llmSettings
      }
    });
  };

  const updateUISettings = (uiSettings: Partial<typeof settings.ui>) => {
    updateSettings({
      ui: {
        ...settings.ui,
        ...uiSettings
      }
    });
  };

  const updatePrivacySettings = (privacySettings: Partial<typeof settings.privacy>) => {
    const newSettings: Partial<typeof settings> = {
      privacy: {
        ...settings.privacy,
        ...privacySettings
      }
    };

    // 外部リクエストが無効化された場合、LLMも無効化する
    if (privacySettings.allowExternalRequests === false) {
      newSettings.llm = {
        ...settings.llm,
        enabled: false
      };
    }

    updateSettings(newSettings);
  };

  return {
    loadSettings,
    saveSettings,
    updateAnalysisSettings,
    updateRuleSettings,
    updateLLMSettings,
    updateUISettings,
    updatePrivacySettings
  };
};

/**
 * 問題管理アクション
 */
export const useIssueActions = () => {
  const {
    applySuggestion,
    dismissIssue,
    applyAllAutoFixes,
    selectIssue,
    setIssueFilters,
    clearFilters
  } = useAppStore();

  const applySuggestionToIssue = (issueId: string, suggestionIndex: number) => {
    applySuggestion(issueId, suggestionIndex);
  };

  const dismissIssueById = (issueId: string) => {
    dismissIssue(issueId);
  };

  const applyAllAutoFixesToIssues = () => {
    applyAllAutoFixes();
  };

  const selectIssueById = (issueId: string | null) => {
    selectIssue(issueId);
  };

  const filterIssuesBySource = (sources: IssueSource[]) => {
    setIssueFilters({ source: sources });
  };

  const filterIssuesBySeverity = (severities: IssueSeverity[]) => {
    setIssueFilters({ severity: severities });
  };

  const filterIssuesByCategory = (categories: IssueCategory[]) => {
    setIssueFilters({ category: categories });
  };

  const clearAllFilters = () => {
    clearFilters();
  };

  return {
    applySuggestionToIssue,
    dismissIssueById,
    applyAllAutoFixesToIssues,
    selectIssueById,
    filterIssuesBySource,
    filterIssuesBySeverity,
    filterIssuesByCategory,
    clearAllFilters
  };
};

/**
 * テキスト管理アクション
 */
export const useTextActions = () => {
  const { setText, setSelectedTextRange } = useAppStore();

  const updateText = (newText: string) => {
    setText(newText);
  };

  const selectTextRange = (range: { start: number; end: number } | null) => {
    setSelectedTextRange(range);
  };

  const insertTextAtPosition = (position: number, textToInsert: string) => {
    const { text } = useAppStore.getState();
    const newText = text.slice(0, position) + textToInsert + text.slice(position);
    setText(newText);
  };

  const replaceTextInRange = (range: { start: number; end: number }, replacement: string) => {
    const { text } = useAppStore.getState();
    const newText = text.slice(0, range.start) + replacement + text.slice(range.end);
    setText(newText);
  };

  return {
    updateText,
    selectTextRange,
    insertTextAtPosition,
    replaceTextInRange
  };
};

/**
 * UI状態管理アクション
 */
export const useUIActions = () => {
  const {
    setSettingsOpen,
    setActiveTab,
    setError,
    clearError
  } = useAppStore();

  const openSettings = () => {
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
  };

  const switchToTab = (tab: 'text' | 'issues' | 'settings') => {
    setActiveTab(tab);
  };

  const showError = (error: string) => {
    setError(error);
  };

  const hideError = () => {
    clearError();
  };

  return {
    openSettings,
    closeSettings,
    switchToTab,
    showError,
    hideError
  };
};
