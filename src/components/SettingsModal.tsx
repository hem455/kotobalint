'use client';

import React, { useMemo, useState } from 'react';
import { useSettings } from '@/lib/hooks';

type TabKey = 'analysis' | 'rules' | 'llm';

export default function SettingsModal() {
  const {
    settings,
    isOpen,
    closeSettings,
    saveSettings,
    updateAnalysisSettings,
    updateRuleSettings,
    updateLLMSettings
  } = useSettings();

  const [activeTab, setActiveTab] = useState<TabKey>('analysis');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => !saving, [saving]);

  if (!isOpen) return null;

  const handleSave = async () => {
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
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  min={100}
                  max={5000}
                  value={settings.analysis.autoDelay}
                  onChange={(e) => updateAnalysisSettings({ autoDelay: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-slate-500">100-5000 の範囲</p>
              </div>

              <div>
                <label className="block text-xs text-slate-600">最大文長</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  min={50}
                  max={1000}
                  value={settings.analysis.maxSentenceLength}
                  onChange={(e) => updateAnalysisSettings({ maxSentenceLength: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-slate-500">50-1000 の範囲</p>
              </div>
            </section>
          )}

          {activeTab === 'rules' && (
            <section aria-label="ルール設定" className="space-y-4">
              <p className="text-sm text-slate-600">ルールセットや個別有効/無効、重要度の設定は後続で追加します。</p>
            </section>
          )}

          {activeTab === 'llm' && (
            <section aria-label="LLM設定" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs text-slate-600">LLM 提案を有効化</label>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={settings.llm.enabled}
                  onChange={(e) => updateLLMSettings({ enabled: e.target.checked })}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600">ベースURL</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.llm.baseUrl}
                  onChange={(e) => updateLLMSettings({ baseUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600">APIキー</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  value={settings.llm.apiKey}
                  onChange={(e) => updateLLMSettings({ apiKey: e.target.value })}
                  placeholder="••••••"
                />
                <p className="mt-1 text-[11px] text-slate-500">保存時はマスクして取り扱います。</p>
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


