'use client';

import React, { useMemo, useState } from 'react';
import { useSettings } from '@/lib/hooks';
import type { LlmProvider, LlmModel, AVAILABLE_MODELS } from '@/types/llm';

// ヘルパー関数
const getAvailableModels = (provider: LlmProvider): LlmModel[] => {
  const models: Record<LlmProvider, LlmModel[]> = {
    gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']
  };
  return models[provider] || [];
};

const getDefaultModelForProvider = (provider: LlmProvider): LlmModel => {
  const defaults: Record<LlmProvider, LlmModel> = {
    gemini: 'gemini-2.5-flash'
  };
  return defaults[provider] || 'gemini-2.5-flash';
};

const getDefaultBaseUrl = (provider: LlmProvider): string => {
  const defaults: Record<LlmProvider, string> = {
    gemini: 'https://generativelanguage.googleapis.com'
  };
  return defaults[provider] || 'https://generativelanguage.googleapis.com';
};

type TabKey = 'analysis' | 'rules' | 'llm';

export default function SettingsModal() {
  const {
    settings,
    isOpen,
    closeSettings,
    saveSettings,
    updateAnalysisSettings,
    updateRuleSettings,
    updateLLMSettings,
    updatePrivacySettings
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('analysis');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const canSave = useMemo(() => !saving && Object.keys(validationErrors).length === 0, [saving, validationErrors]);

  if (!isOpen) return null;

  // 設定値の検証
  const validateSettings = () => {
    const errors: Record<string, string> = {};

    // 解析設定の検証
    if (settings.analysis.autoDelay < 100 || settings.analysis.autoDelay > 5000) {
      errors.autoDelay = '自動解析ディレイは100-5000の範囲で設定してください';
    }
    if (typeof settings.analysis.maxSentenceLength !== 'number' || !Number.isFinite(settings.analysis.maxSentenceLength) || !Number.isInteger(settings.analysis.maxSentenceLength)) {
      errors.maxSentenceLength = '最大文長は整数で設定してください';
    } else if (settings.analysis.maxSentenceLength < 50 || settings.analysis.maxSentenceLength > 10000) {
      errors.maxSentenceLength = '最大文長は50-10000の範囲で設定してください';
    }

    // LLM設定の検証
    if (settings.llm.enabled) {
      if (!settings.llm.baseUrl || !settings.llm.baseUrl.trim()) {
        errors.baseUrl = 'LLMが有効な場合、ベースURLは必須です';
      } else {
        try {
          const url = new URL(settings.llm.baseUrl);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            errors.baseUrl = 'ベースURLはhttp://またはhttps://で始まる必要があります';
          }
        } catch {
          errors.baseUrl = 'ベースURLは有効なURL形式である必要があります';
        }
      }
      
      if ((settings.llm.timeoutMs || 60000) < 1000 || (settings.llm.timeoutMs || 60000) > 120000) {
        errors.timeout = 'タイムアウトは1000-120000の範囲で設定してください';
      }
      
      if ((settings.llm.maxSuggestions || 3) < 1 || (settings.llm.maxSuggestions || 3) > 10) {
        errors.maxSuggestions = '最大提案数は1-10の範囲で設定してください';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      setError('設定値にエラーがあります。各項目を確認してください。');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await saveSettings(settings);
      closeSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="settings-title" className="text-sm font-semibold text-slate-800">設定</h2>
          <button type="button" onClick={closeSettings} className="text-slate-600 hover:text-slate-800" aria-label="設定を閉じる">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b px-2 pt-2">
          <TabButton label="解析" active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
          <TabButton label="ルール" active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} />
          <TabButton label="LLM" active={activeTab === 'llm'} onClick={() => setActiveTab('llm')} />
        </div>

        {/* タブ内容 */}
        <div className="max-h-[70vh] overflow-auto px-4 py-3">
          {activeTab === 'analysis' && (
            <section aria-label="解析設定" className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600">解析トリガー</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.analysis.trigger}
                  onChange={(e) => updateAnalysisSettings({ trigger: e.target.value as 'manual' | 'auto' })}
                >
                  <option value="manual">手動</option>
                  <option value="auto">自動</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-600">自動解析ディレイ(ms)</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${
                    validationErrors.autoDelay ? 'border-red-300 bg-red-50' : ''
                  }`}
                  min={100}
                  max={5000}
                  value={settings.analysis.autoDelay}
                  onChange={(e) => updateAnalysisSettings({ autoDelay: Number(e.target.value) })}
                />
                {validationErrors.autoDelay ? (
                  <p className="mt-1 text-[11px] text-red-600">{validationErrors.autoDelay}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">100-5000 の範囲</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600">最大文長</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${
                    validationErrors.maxSentenceLength ? 'border-red-300 bg-red-50' : ''
                  }`}
                  min={50}
                  max={10000}
                  value={settings.analysis.maxSentenceLength}
                  onChange={(e) => updateAnalysisSettings({ maxSentenceLength: Number(e.target.value) })}
                />
                {validationErrors.maxSentenceLength ? (
                  <p className="mt-1 text-[11px] text-red-600">{validationErrors.maxSentenceLength}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">50-10000 の範囲</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'rules' && (
            <section aria-label="ルール設定" className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600">ルールセット</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.rules.activeRuleset}
                  onChange={(e) => updateRuleSettings({ activeRuleset: e.target.value })}
                >
                  <option value="japanese-standard">日本語標準ルール</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">現在利用可能なルールセット</p>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-2">個別ルール設定</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  <div className="text-xs text-slate-500 text-center py-4">
                    ルール一覧の読み込み機能は後続で実装します
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-2">重要度オーバーライド</label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  <div className="text-xs text-slate-500 text-center py-2">
                    ルール重要度の個別変更機能は後続で実装します
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-slate-600">ルールベース解析を有効化</label>
                  <p className="text-[11px] text-slate-500">無効にするとルールベースの問題検出が停止します</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!settings.rules.disabledRules.includes('all')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // 全ルールを有効化
                      updateRuleSettings({ disabledRules: [] });
                    } else {
                      // 全ルールを無効化
                      updateRuleSettings({ disabledRules: ['all'] });
                    }
                  }}
                />
              </div>
            </section>
          )}

          {activeTab === 'llm' && (
            <section aria-label="LLM設定" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-slate-600">LLM 提案を有効化</label>
                  {!settings.privacy.allowExternalRequests && (
                    <p className="text-[11px] text-slate-500">外部データ送信が無効のため使用できません</p>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.llm.enabled}
                  disabled={!settings.privacy.allowExternalRequests}
                  onChange={(e) => updateLLMSettings({ enabled: e.target.checked })}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600">プロバイダー</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.llm.provider}
                  onChange={(e) => updateLLMSettings({ 
                    provider: e.target.value as LlmProvider,
                    model: getDefaultModelForProvider(e.target.value as LlmProvider)
                  })}
                >
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-600">モデル</label>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.llm.model}
                  onChange={(e) => updateLLMSettings({ model: e.target.value as LlmModel })}
                >
                  {getAvailableModels(settings.llm.provider).map((model) => {
                    const displayNames: Record<string, string> = {
                      'gemini-2.5-flash': 'Gemini 2.5 Flash',
                      'gemini-2.5-pro': 'Gemini 2.5 Pro',
                      'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
                      'gpt-oss:20b': 'GPT-OSS 20B'
                    };
                    return (
                      <option key={model} value={model}>
                        {displayNames[model] || model}
                      </option>
                    );
                  })}
                </select>
              </div>

              {settings.llm.provider !== 'gemini' && (
                <div>
                  <label className="block text-xs text-slate-600">ベースURL</label>
                  <input
                    type="text"
                    className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${
                      validationErrors.baseUrl ? 'border-red-300 bg-red-50' : ''
                    }`}
                    value={settings.llm.baseUrl || getDefaultBaseUrl(settings.llm.provider)}
                    onChange={(e) => updateLLMSettings({ baseUrl: e.target.value })}
                    placeholder={getDefaultBaseUrl(settings.llm.provider)}
                  />
                  {validationErrors.baseUrl && (
                    <p className="mt-1 text-[11px] text-red-600">{validationErrors.baseUrl}</p>
                  )}
                </div>
              )}

              {settings.llm.provider === 'gemini' && (
                <div>
                  <label className="block text-xs text-slate-600">APIキー</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={settings.llm.apiKey || ''}
                    onChange={(e) => updateLLMSettings({ apiKey: e.target.value })}
                    placeholder="••••••"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">保存時はマスクして取り扱います。</p>
                </div>
              )}

              {settings.llm.provider === 'gemini' && (
                <div>
                  <label className="block text-xs text-slate-600">Thinking Budget</label>
                  <select
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                    value={settings.llm.thinkingBudget ?? 512}
                    onChange={(e) => updateLLMSettings({ thinkingBudget: Number(e.target.value) })}
                  >
                    <option value={0}>0 (思考OFF)</option>
                    <option value={256}>256</option>
                    <option value={512}>512 (推奨)</option>
                    <option value={1024}>1024</option>
                    <option value={2048}>2048</option>
                    <option value={-1}>-1 (自動)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">思考プロセスの予算。0=OFF、-1=自動、数値=上限</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-600">タイムアウト (ms)</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${
                    validationErrors.timeout ? 'border-red-300 bg-red-50' : ''
                  }`}
                  min={1000}
                  max={120000}
                  value={settings.llm.timeoutMs || 60000}
                  onChange={(e) => updateLLMSettings({ timeoutMs: Number(e.target.value) })}
                />
                {validationErrors.timeout ? (
                  <p className="mt-1 text-[11px] text-red-600">{validationErrors.timeout}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">1000-120000 の範囲（デフォルト: 60000ms）</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600">最大提案数</label>
                <input
                  type="number"
                  className={`mt-1 w-full rounded-md border px-2 py-1 text-sm ${
                    validationErrors.maxSuggestions ? 'border-red-300 bg-red-50' : ''
                  }`}
                  min={1}
                  max={10}
                  value={settings.llm.maxSuggestions}
                  onChange={(e) => updateLLMSettings({ maxSuggestions: Number(e.target.value) })}
                />
                {validationErrors.maxSuggestions ? (
                  <p className="mt-1 text-[11px] text-red-600">{validationErrors.maxSuggestions}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">1-10 の範囲（デフォルト: 3）</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-slate-600">外部データ送信を許可</label>
                  <p className="text-[11px] text-slate-500">無効にするとLLM提案は使用できません</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.privacy.allowExternalRequests}
                  onChange={(e) => updatePrivacySettings({ allowExternalRequests: e.target.checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-slate-600">分析ログを記録</label>
                  <p className="text-[11px] text-slate-500">使用状況の分析データを収集します</p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.privacy.logAnalytics}
                  onChange={(e) => updatePrivacySettings({ logAnalytics: e.target.checked })}
                />
              </div>
            </section>
          )}

          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button type="button" onClick={closeSettings} className="btn-ghost text-sm">キャンセル</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="btn-primary rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            aria-disabled={!canSave}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mr-2 rounded-t-md px-3 py-2 text-xs ${active ? 'bg-white text-slate-900 border-x border-t' : 'text-slate-600 hover:text-slate-800'}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}


