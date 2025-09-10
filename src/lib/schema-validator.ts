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
}

/**
 * スキーマバリデータークラス
 */
export class SchemaValidator {
  private config: SchemaValidationConfig;

  constructor(config?: Partial<SchemaValidationConfig>) {
    this.config = {
      maxIssues: 10,
      maxSuggestionsPerIssue: 3,
      allowedSeverities: ['info', 'warn', 'error'],
      allowedCategories: ['style', 'grammar', 'honorific', 'consistency', 'risk'],
      maxTextLength: 1000,
      maxSuggestionLength: 200,
      ...config
    };
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

    // 必須フィールドのチェック
    if (!issueData.id || typeof issueData.id !== 'string') {
      errors.push('idが必須です');
    }

    if (!issueData.message || typeof issueData.message !== 'string') {
      errors.push('messageが必須です');
    }

    if (!issueData.range || typeof issueData.range !== 'object') {
      errors.push('rangeが必須です');
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

    // 提案の検証
    if (issueData.suggestions && Array.isArray(issueData.suggestions)) {
      if (issueData.suggestions.length > this.config.maxSuggestionsPerIssue) {
        errors.push(`提案が多すぎます（最大${this.config.maxSuggestionsPerIssue}個）`);
      }

      const validatedSuggestions: Suggestion[] = [];
      for (let i = 0; i < issueData.suggestions.length; i++) {
        const suggestionResult = this.validateSuggestion(issueData.suggestions[i], i);
        if (suggestionResult.isValid && suggestionResult.sanitizedData) {
          validatedSuggestions.push(suggestionResult.sanitizedData);
        } else {
          errors.push(...suggestionResult.errors.map(e => `Suggestion ${i}: ${e}`));
        }
      }

      // 検証された提案を設定
      if (validatedSuggestions.length > 0) {
        issueData.suggestions = validatedSuggestions;
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
        confidence: Math.max(0, Math.min(1, issueData.confidence || 0.5))
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
      confidence: Math.max(0, Math.min(1, suggestionData.confidence || 0.5)),
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
