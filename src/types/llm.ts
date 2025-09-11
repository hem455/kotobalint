/**
 * LLM関連の型定義
 * プロバイダーとモデルの列挙、設定スキーマ
 */

export type LlmProvider = "gemini";

export type LlmModel = 
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash-lite";

export type PrivacyMode = "off" | "logs-only" | "llm-input" | "both";

export interface LlmSettings {
  enabled: boolean;
  provider: LlmProvider;              // 既定: "gemini"
  model: LlmModel;                    // 既定: "gemini-2.5-flash"
  baseUrl?: string;                   // Geminiでは任意
  apiKey?: string;                    // Gemini用
  timeoutMs?: number;
  maxSuggestions?: number;
  thinkingBudget?: number | 0 | -1;   // 0=思考OFF, -1=自動, 数値=上限
  privacyMode?: PrivacyMode;          // 既定: "off"
}

export interface LlmRequest {
  text: string;
  settings: LlmSettings;
}

export interface LlmResponse {
  answer: string;
  disabled?: boolean;
  error?: string;
  model?: string;
  provider?: LlmProvider;
  elapsedMs?: number;
}

// プロバイダー別のデフォルト設定
export const DEFAULT_LLM_SETTINGS: Record<LlmProvider, Partial<LlmSettings>> = {
  gemini: {
    provider: "gemini",
    model: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com",
    timeoutMs: 30000,
    maxSuggestions: 3,
    thinkingBudget: 512,
    privacyMode: "off"
  }
};

// プロバイダー別の利用可能モデル
export const AVAILABLE_MODELS: Record<LlmProvider, LlmModel[]> = {
  gemini: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.5-flash-lite"
  ]
};
