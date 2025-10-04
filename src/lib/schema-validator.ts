/**
 * 出力スキーマ強制機能
 * LLM応答を定義済みスキーマで厳格に検証し、非準拠の場合は安全なデフォルト応答へフォールバック
 */

import type { Issue, Suggestion } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

export interface SchemaValidationConfig {
  maxIssues: number;
  maxSuggestionsPerIssue: number;
  allowedSeverities: string[];
  allowedCategories: string[];
  maxTextLength: number;
  maxSuggestionLength: number;
  /** 追加: デバッグ出力を有効化 */
  debug?: boolean;
  /** 追加: ロガー（debug/info/warn/error/log のいずれかを持つオブジェクト） */
  logger?: {
    debug?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    log?: (...args: any[]) => void;
  };
}

/**
 * スキーマバリデータークラス
 */
export class SchemaValidator {
  private config: SchemaValidationConfig;

  constructor(config?: Partial<SchemaValidationConfig>) {
    const noop = () => {};
    const defaultLogger = {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      log: noop
    };
    const incomingLogger = config?.logger;
    const safeLogger = (incomingLogger && (typeof incomingLogger === 'object'))
      ? incomingLogger
      : defaultLogger;

    this.config = {
      maxIssues: 30, // 長文対応のため10→30に増加
      maxSuggestionsPerIssue: 3,
      allowedSeverities: ['info', 'warn', 'error'],
      allowedCategories: ['style', 'grammar', 'honorific', 'consistency', 'risk'],
      maxTextLength: 1000,
      maxSuggestionLength: 200,
      debug: false,
      ...config,
      // logger は常に安全なものを優先
      logger: (config?.logger && typeof config.logger === 'object') ? config.logger : safeLogger
    };
  }

  // 追加: デバッグ用の内部ロガー
  private logDebug = (...args: any[]): void => {
    if (!this.config?.debug) return;
    const logger = this.config?.logger || console;
    const fn = (typeof logger.debug === 'function') ? logger.debug
      : (typeof logger.log === 'function') ? logger.log
      : null;
    if (!fn) return;
    try {
      fn.apply(logger, args as any);
    } catch (_) {
      // 予期せぬシリアライズエラー等は握りつぶす（本番での安全性優先）
    }
  };

  // 追加: Issueのログ用レダクション
  private redactIssue(input: any): { id?: any; severity?: any; category?: any; range?: any; message?: string } {
    const id = input?.id;
    const severity = input?.severity;
    const category = input?.category;
    const range = input?.range;
    const originalMessage: string = typeof input?.message === 'string' ? input.message : '';
    const truncated = originalMessage.length > 200 ? (originalMessage.slice(0, 200) + '…') : originalMessage;
    return { id, severity, category, range, message: truncated };
  }

  /**
   * LLM応答を検証
   */
  validateLLMResponse(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 基本的な構造チェック
    if (!data || typeof data !== 'object') {
      errors.push('レスポンスがオブジェクトではありません');
      return { isValid: false, errors, warnings };
    }

    // 2. issues配列の存在チェック
    if (!data.issues || !Array.isArray(data.issues)) {
      errors.push('issues配列が存在しません');
      return { isValid: false, errors, warnings };
    }

    // 3. issues配列の長さチェック
    if (data.issues.length > this.config.maxIssues) {
      errors.push(`issues配列が長すぎます（最大${this.config.maxIssues}個）`);
      return { isValid: false, errors, warnings };
    }

    // 4. 各issueの検証
    const validatedIssues: Issue[] = [];
    for (let i = 0; i < data.issues.length; i++) {
      const issueResult = this.validateIssue(data.issues[i], i);
      if (issueResult.isValid && issueResult.sanitizedData) {
        validatedIssues.push(issueResult.sanitizedData);
      } else {
        errors.push(...issueResult.errors.map(e => `Issue ${i}: ${e}`));
        warnings.push(...issueResult.warnings.map(w => `Issue ${i}: ${w}`));
      }
    }

    // 5. 検証結果の判定
    const isValid = errors.length === 0;
    
    return {
      isValid,
      errors,
      warnings,
      sanitizedData: isValid ? { issues: validatedIssues } : undefined
    };
  }

  /**
   * 個別のIssueを検証
   */
  private validateIssue(issueData: any, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // デバッグログ（レダクト済み）
    this.logDebug(`Validating issue ${index}:`, this.redactIssue(issueData));

    // 必須フィールドのチェック
    if (!issueData.id || typeof issueData.id !== 'string') {
      errors.push('idが必須です');
    }

    if (!issueData.message || typeof issueData.message !== 'string') {
      errors.push('messageが必須です');
    }

    if (!issueData.range || typeof issueData.range !== 'object') {
      errors.push('rangeが必須です');
      this.logDebug('Range validation failed:', this.redactIssue({ ...issueData, range: issueData.range }));
    }

    // メッセージの長さチェック
    if (issueData.message && issueData.message.length > this.config.maxTextLength) {
      errors.push(`messageが長すぎます（最大${this.config.maxTextLength}文字）`);
    }

    // 重要度の検証
    if (issueData.severity && !this.config.allowedSeverities.includes(issueData.severity)) {
      errors.push(`無効な重要度: ${issueData.severity}`);
    }

    // カテゴリの検証
    if (issueData.category && !this.config.allowedCategories.includes(issueData.category)) {
      errors.push(`無効なカテゴリ: ${issueData.category}`);
    }

    // 範囲の検証
    if (issueData.range) {
      const rangeResult = this.validateRange(issueData.range);
      if (!rangeResult.isValid) {
        errors.push(...rangeResult.errors);
      }
    }

    // 提案の検証（寛容モード: 無効な提案は警告として記録、スキップする）
    if (issueData.suggestions && Array.isArray(issueData.suggestions)) {
      if (issueData.suggestions.length > this.config.maxSuggestionsPerIssue) {
        warnings.push(`提案が多すぎます（最大${this.config.maxSuggestionsPerIssue}個）。最初の${this.config.maxSuggestionsPerIssue}個のみ使用します。`);
        issueData.suggestions = issueData.suggestions.slice(0, this.config.maxSuggestionsPerIssue);
      }

      const validatedSuggestions: Suggestion[] = [];
      for (let i = 0; i < issueData.suggestions.length; i++) {
        const suggestionResult = this.validateSuggestion(issueData.suggestions[i], i);
        if (suggestionResult.isValid && suggestionResult.sanitizedData) {
          validatedSuggestions.push(suggestionResult.sanitizedData);
        } else {
          // エラーではなく警告として記録（このsuggestionをスキップするだけ）
          warnings.push(...suggestionResult.errors.map(e => `Suggestion ${i}: ${e} (スキップしました)`));
        }
      }

      // 検証された提案を設定（空でも問題なし）
      issueData.suggestions = validatedSuggestions;

      // 全提案が無効な場合は警告
      if (validatedSuggestions.length === 0 && issueData.suggestions.length > 0) {
        warnings.push('すべての提案が無効でした。Issue自体は保持されます。');
      }
    }

    // サニタイズされたデータを構築
    const sanitizedData: Issue = {
      id: this.sanitizeString(issueData.id) || `issue_${index}_${Date.now()}`,
      source: 'llm',
      severity: this.config.allowedSeverities.includes(issueData.severity) ? issueData.severity : 'info',
      category: this.config.allowedCategories.includes(issueData.category) ? issueData.category : 'style',
      message: this.sanitizeString(issueData.message) || 'LLMによる提案',
      range: issueData.range || { start: 0, end: 0 },
      suggestions: issueData.suggestions || [],
      metadata: {
        llmGenerated: true,
        confidence: Math.max(0, Math.min(1, (issueData.confidence ?? 0.5)))
      }
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedData
    };
  }

  /**
   * 範囲を検証
   */
  private validateRange(range: any): ValidationResult {
    const errors: string[] = [];

    if (typeof range.start !== 'number' || typeof range.end !== 'number') {
      errors.push('rangeのstartとendは数値である必要があります');
    } else if (range.start < 0 || range.end < 0) {
      errors.push('rangeのstartとendは0以上である必要があります');
    } else if (range.start >= range.end) {
      errors.push('rangeのstartはendより小さくする必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: []
    };
  }

  /**
   * 提案を検証
   */
  private validateSuggestion(suggestionData: any, index: number): ValidationResult {
    const errors: string[] = [];

    if (!suggestionData.text || typeof suggestionData.text !== 'string') {
      errors.push('textが必須です');
    } else if (suggestionData.text.length > this.config.maxSuggestionLength) {
      errors.push(`textが長すぎます（最大${this.config.maxSuggestionLength}文字）`);
    }

    const sanitizedData: Suggestion = {
      text: this.sanitizeString(suggestionData.text) || '',
      rationale: this.sanitizeString(suggestionData.rationale) || 'LLMによる提案',
      confidence: Math.max(0, Math.min(1, (suggestionData.confidence ?? 0.5))),
      isPreferred: Boolean(suggestionData.isPreferred)
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      sanitizedData
    };
  }

  /**
   * 文字列をサニタイズ
   */
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return '';
    
    // 危険な文字を除去
    return str
      .replace(/[<>\"'&]/g, '') // HTML特殊文字
      .replace(/[\x00-\x1F\x7F]/g, '') // 制御文字
      .trim();
  }

  /**
   * 安全なデフォルト応答を生成
   */
  generateSafeFallback(): { issues: Issue[] } {
    return {
      issues: [{
        id: `fallback_${Date.now()}`,
        source: 'llm',
        severity: 'info',
        category: 'style',
        message: 'LLMからの応答を処理できませんでした。ルールベースの結果をご確認ください。',
        range: { start: 0, end: 0 },
        suggestions: [],
        metadata: {
          llmGenerated: false,
          confidence: 0.0,
          fallback: true
        }
      }]
    };
  }
}

/**
 * デフォルトのスキーマバリデーター
 */
export const schemaValidator = new SchemaValidator();
