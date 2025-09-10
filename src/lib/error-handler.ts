/**
 * エラーハンドリングと分類機能
 * より具体的なエラー分類とユーザーフレンドリーなメッセージを提供
 */

export enum ErrorType {
  // ネットワーク関連
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // API関連
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  
  // データ関連
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEMA_ERROR = 'SCHEMA_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  
  // セキュリティ関連
  PII_DETECTION_ERROR = 'PII_DETECTION_ERROR',
  PROMPT_INJECTION_ERROR = 'PROMPT_INJECTION_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR',
  
  // システム関連
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorInfo {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

/**
 * エラーハンドラークラス
 */
export class ErrorHandler {
  private static readonly ERROR_MESSAGES: Record<ErrorType, { userMessage: string; retryable: boolean; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
    [ErrorType.NETWORK_ERROR]: {
      userMessage: 'ネットワーク接続に問題があります。しばらくしてから再試行してください。',
      retryable: true,
      severity: 'medium'
    },
    [ErrorType.TIMEOUT_ERROR]: {
      userMessage: 'リクエストがタイムアウトしました。処理時間が長くなっています。',
      retryable: true,
      severity: 'medium'
    },
    [ErrorType.CONNECTION_ERROR]: {
      userMessage: 'サーバーに接続できません。ネットワーク設定を確認してください。',
      retryable: true,
      severity: 'high'
    },
    [ErrorType.API_ERROR]: {
      userMessage: 'APIエラーが発生しました。しばらくしてから再試行してください。',
      retryable: true,
      severity: 'medium'
    },
    [ErrorType.RATE_LIMIT_ERROR]: {
      userMessage: 'リクエスト制限に達しました。しばらくしてから再試行してください。',
      retryable: true,
      severity: 'low'
    },
    [ErrorType.AUTHENTICATION_ERROR]: {
      userMessage: '認証に失敗しました。APIキーを確認してください。',
      retryable: false,
      severity: 'high'
    },
    [ErrorType.VALIDATION_ERROR]: {
      userMessage: '入力データに問題があります。入力内容を確認してください。',
      retryable: false,
      severity: 'low'
    },
    [ErrorType.SCHEMA_ERROR]: {
      userMessage: 'データ形式に問題があります。システム管理者にお問い合わせください。',
      retryable: false,
      severity: 'medium'
    },
    [ErrorType.PARSING_ERROR]: {
      userMessage: 'データの解析に失敗しました。入力内容を確認してください。',
      retryable: false,
      severity: 'medium'
    },
    [ErrorType.PII_DETECTION_ERROR]: {
      userMessage: '個人情報が検出されました。機密情報を除いて再試行してください。',
      retryable: false,
      severity: 'high'
    },
    [ErrorType.PROMPT_INJECTION_ERROR]: {
      userMessage: '不正な入力が検出されました。入力内容を確認してください。',
      retryable: false,
      severity: 'high'
    },
    [ErrorType.SECURITY_ERROR]: {
      userMessage: 'セキュリティ上の問題が発生しました。システム管理者にお問い合わせください。',
      retryable: false,
      severity: 'critical'
    },
    [ErrorType.CONFIGURATION_ERROR]: {
      userMessage: '設定に問題があります。システム管理者にお問い合わせください。',
      retryable: false,
      severity: 'high'
    },
    [ErrorType.RESOURCE_ERROR]: {
      userMessage: 'システムリソースが不足しています。しばらくしてから再試行してください。',
      retryable: true,
      severity: 'medium'
    },
    [ErrorType.UNKNOWN_ERROR]: {
      userMessage: '予期しないエラーが発生しました。システム管理者にお問い合わせください。',
      retryable: false,
      severity: 'high'
    }
  };

  /**
   * エラーを分類して情報を取得
   */
  static classifyError(error: Error, context?: Record<string, any>): ErrorInfo {
    const errorMessage = error.message.toLowerCase();
    
    // ネットワーク関連エラーの判定
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return this.createErrorInfo(ErrorType.NETWORK_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return this.createErrorInfo(ErrorType.TIMEOUT_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
      return this.createErrorInfo(ErrorType.CONNECTION_ERROR, error.message, context);
    }
    
    // API関連エラーの判定
    if (errorMessage.includes('api') || errorMessage.includes('http')) {
      return this.createErrorInfo(ErrorType.API_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return this.createErrorInfo(ErrorType.RATE_LIMIT_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
      return this.createErrorInfo(ErrorType.AUTHENTICATION_ERROR, error.message, context);
    }
    
    // データ関連エラーの判定
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return this.createErrorInfo(ErrorType.VALIDATION_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('schema') || errorMessage.includes('format')) {
      return this.createErrorInfo(ErrorType.SCHEMA_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('parse') || errorMessage.includes('json')) {
      return this.createErrorInfo(ErrorType.PARSING_ERROR, error.message, context);
    }
    
    // セキュリティ関連エラーの判定
    if (errorMessage.includes('pii') || errorMessage.includes('personal')) {
      return this.createErrorInfo(ErrorType.PII_DETECTION_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('injection') || errorMessage.includes('malicious')) {
      return this.createErrorInfo(ErrorType.PROMPT_INJECTION_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('security') || errorMessage.includes('attack')) {
      return this.createErrorInfo(ErrorType.SECURITY_ERROR, error.message, context);
    }
    
    // システム関連エラーの判定
    if (errorMessage.includes('config') || errorMessage.includes('setting')) {
      return this.createErrorInfo(ErrorType.CONFIGURATION_ERROR, error.message, context);
    }
    
    if (errorMessage.includes('resource') || errorMessage.includes('memory')) {
      return this.createErrorInfo(ErrorType.RESOURCE_ERROR, error.message, context);
    }
    
    // デフォルト
    return this.createErrorInfo(ErrorType.UNKNOWN_ERROR, error.message, context);
  }

  /**
   * エラー情報を作成
   */
  private static createErrorInfo(type: ErrorType, message: string, context?: Record<string, any>): ErrorInfo {
    const errorConfig = this.ERROR_MESSAGES[type];
    
    return {
      type,
      message,
      userMessage: errorConfig.userMessage,
      retryable: errorConfig.retryable,
      severity: errorConfig.severity,
      context
    };
  }

  /**
   * エラーがリトライ可能かチェック
   */
  static isRetryable(error: Error): boolean {
    const errorInfo = this.classifyError(error);
    return errorInfo.retryable;
  }

  /**
   * エラーの重要度を取得
   */
  static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const errorInfo = this.classifyError(error);
    return errorInfo.severity;
  }

  /**
   * ユーザーフレンドリーなエラーメッセージを取得
   */
  static getUserMessage(error: Error): string {
    const errorInfo = this.classifyError(error);
    return errorInfo.userMessage;
  }

  /**
   * エラーをログ用にフォーマット
   */
  static formatForLogging(error: Error, context?: Record<string, any>): string {
    const errorInfo = this.classifyError(error, context);
    
    return JSON.stringify({
      type: errorInfo.type,
      message: errorInfo.message,
      severity: errorInfo.severity,
      retryable: errorInfo.retryable,
      context: errorInfo.context,
      timestamp: new Date().toISOString()
    });
  }
}

