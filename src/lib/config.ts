/**
 * アプリケーション設定管理
 * 環境変数からの設定読み込みとデフォルト値の管理
 */

export interface PIIConfig {
  enabled: boolean;
  sensitivePatterns: string[];
  maskCharacter: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface PromptSanitizerConfig {
  enabled: boolean;
  maxLength: number;
  allowedChars: string;
  logThreats: boolean;
}

export interface SchemaValidatorConfig {
  maxIssues: number;
  maxSuggestionsPerIssue: number;
  allowedSeverities: string[];
  allowedCategories: string[];
  maxTextLength: number;
  maxSuggestionLength: number;
}

export interface StreamingConfig {
  enabled: boolean;
  chunkSize: number;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface ObservabilityConfig {
  enabled: boolean;
  maxLogs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
  auditLogEnabled: boolean;
}

export interface AppConfig {
  pii: PIIConfig;
  promptSanitizer: PromptSanitizerConfig;
  schemaValidator: SchemaValidatorConfig;
  streaming: StreamingConfig;
  observability: ObservabilityConfig;
}

const DEFAULT_ALLOWED_CHARS = String.raw`[ぁ-んァ-ヶ一-龯a-zA-Z0-9\s。、！？「」『』（）［］｛｝：；"'.,?!\-_=+*&%$#@~\`|\\/<>]`;

/**
 * ログレベルの型ガード
 */
function isValidLogLevel(level: string): level is 'debug' | 'info' | 'warn' | 'error' {
  return level === 'debug' || level === 'info' || level === 'warn' || level === 'error';
}

/**
 * 設定を環境変数から読み込み
 */
function loadConfig(): AppConfig {
  return {
    pii: {
      enabled: process.env.PII_DETECTION_ENABLED === 'true',
      sensitivePatterns: process.env.PII_SENSITIVE_PATTERNS?.split(',') || [],
      maskCharacter: process.env.PII_MASK_CHARACTER || '[MASKED]',
      logLevel: (process.env.PII_LOG_LEVEL && isValidLogLevel(process.env.PII_LOG_LEVEL)) 
        ? process.env.PII_LOG_LEVEL 
        : 'info'
    },
    promptSanitizer: {
      enabled: process.env.PROMPT_SANITIZER_ENABLED !== 'false',
      maxLength: parseInt(process.env.PROMPT_MAX_LENGTH || '1000'),
      allowedChars: process.env.PROMPT_ALLOWED_CHARS || DEFAULT_ALLOWED_CHARS,
      logThreats: process.env.PROMPT_LOG_THREATS === 'true'
    },
    schemaValidator: {
      maxIssues: parseInt(process.env.SCHEMA_MAX_ISSUES || '10'),
      maxSuggestionsPerIssue: parseInt(process.env.SCHEMA_MAX_SUGGESTIONS || '3'),
      allowedSeverities: process.env.SCHEMA_ALLOWED_SEVERITIES?.split(',') || ['info', 'warn', 'error'],
      allowedCategories: process.env.SCHEMA_ALLOWED_CATEGORIES?.split(',') || ['style', 'grammar', 'honorific', 'consistency', 'risk'],
      maxTextLength: parseInt(process.env.SCHEMA_MAX_TEXT_LENGTH || '1000'),
      maxSuggestionLength: parseInt(process.env.SCHEMA_MAX_SUGGESTION_LENGTH || '200')
    },
    streaming: {
      enabled: process.env.STREAMING_ENABLED === 'true',
      chunkSize: parseInt(process.env.STREAMING_CHUNK_SIZE || '1000'),
      timeout: parseInt(process.env.STREAMING_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.STREAMING_MAX_RETRIES || '3'),
      retryDelay: parseInt(process.env.STREAMING_RETRY_DELAY || '1000')
    },
    observability: {
      enabled: process.env.OBSERVABILITY_ENABLED !== 'false',
      maxLogs: parseInt(process.env.OBSERVABILITY_MAX_LOGS || '1000'),
      logLevel: (process.env.OBSERVABILITY_LOG_LEVEL && isValidLogLevel(process.env.OBSERVABILITY_LOG_LEVEL)) 
        ? process.env.OBSERVABILITY_LOG_LEVEL 
        : 'info',
      metricsEnabled: process.env.OBSERVABILITY_METRICS_ENABLED !== 'false',
      auditLogEnabled: process.env.OBSERVABILITY_AUDIT_LOG_ENABLED !== 'false'
    }
  };
}

/**
 * 設定インスタンス（内部変数）
 */
let config = loadConfig();

/**
 * 設定を取得（イミュータブル）
 */
export function getConfig(): Readonly<AppConfig> {
  return config;
}

/**
 * 設定を更新
 */
export function updateConfig(newConfig: Partial<AppConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 設定をリセット
 */
export function resetConfig(): void {
  config = loadConfig();
}

/**
 * 設定を検証
 */
export function validateConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // PII設定の検証
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.pii.logLevel)) {
    errors.push(`PII logLevel must be one of: ${validLogLevels.join(', ')}`);
  }

  // Prompt Sanitizer設定の検証
  if (config.promptSanitizer.maxLength < 1) {
    errors.push('Prompt sanitizer maxLength must be at least 1');
  }

  // スキーマバリデーター設定の検証
  if (config.schemaValidator.maxIssues < 1) {
    errors.push('Schema maxIssues must be at least 1');
  }

  if (config.schemaValidator.maxSuggestionsPerIssue < 1) {
    errors.push('Schema maxSuggestionsPerIssue must be at least 1');
  }

  // ストリーミング設定の検証
  if (config.streaming.chunkSize < 1) {
    errors.push('Streaming chunkSize must be at least 1');
  }

  if (config.streaming.timeout < 1000) {
    errors.push('Streaming timeout must be at least 1000ms');
  }

  if (config.streaming.maxRetries < 0) {
    errors.push('Streaming maxRetries must be at least 0');
  }

  if (config.streaming.retryDelay < 0) {
    errors.push('Streaming retryDelay must be at least 0');
  }

  // Observability設定の検証
  if (config.observability.maxLogs < 1) {
    errors.push('Observability maxLogs must be at least 1');
  }

  if (!validLogLevels.includes(config.observability.logLevel)) {
    errors.push(`Observability logLevel must be one of: ${validLogLevels.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

