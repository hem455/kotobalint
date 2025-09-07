import { NextRequest, NextResponse } from 'next/server';
import type { AppSettings, ApiResponse } from '@/types';

/**
 * APIキーをマスクするユーティリティ関数
 */
function maskApiKey(apiKey: string | undefined): string {
  if (!apiKey || apiKey.length === 0) {
    return '';
  }
  
  if (apiKey.length <= 4) {
    return '***';
  }
  
  // 最初の2文字と最後の2文字を表示し、中間を***でマスク
  return `${apiKey.slice(0, 2)}***${apiKey.slice(-2)}`;
}

/**
 * 設定オブジェクトからAPIキーをマスクした安全なコピーを作成
 */
function createSafeSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    llm: {
      ...settings.llm,
      apiKey: maskApiKey(settings.llm.apiKey)
    }
  };
}

// デフォルト設定
const DEFAULT_SETTINGS: AppSettings = {
  analysis: {
    trigger: 'manual',
    autoDelay: 500,
    maxSentenceLength: 200
  },
  rules: {
    activeRuleset: 'japanese-standard',
    disabledRules: [],
    severityOverrides: {}
  },
  llm: {
    enabled: false,
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    timeout: 10000,
    maxSuggestions: 3
  },
  ui: {
    theme: 'light',
    fontSize: 'medium',
    showLineNumbers: true,
    fontFamily: 'monospace'
  },
  privacy: {
    allowExternalRequests: false,
    logAnalytics: false
  }
};

/**
 * GET /api/settings - 設定を取得
 */
export async function GET(): Promise<NextResponse<ApiResponse<AppSettings>>> {
  try {
    // 実際のアプリケーションでは、ここでデータベースやファイルから設定を読み込む
    // 今回はデフォルト設定を返す
    const settings = { ...DEFAULT_SETTINGS };
    
    // APIキーをマスクした安全な設定を返す
    const safeSettings = createSafeSettings(settings);
    
    return NextResponse.json({
      success: true,
      data: safeSettings
    });

  } catch (error) {
    console.error('Settings GET API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '設定の取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/settings - 設定を保存
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{
  saved: boolean;
  settings: AppSettings;
}>>> {
  try {
    const body: Partial<AppSettings> = await request.json();
    
    // 設定の検証
    const validationResult = validateSettings(body);
    if (!validationResult.isValid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: '設定が無効です',
          details: validationResult.errors
        }
      }, { status: 400 });
    }

    // デフォルト設定とマージ
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...body,
      analysis: {
        ...DEFAULT_SETTINGS.analysis,
        ...body.analysis
      },
      rules: {
        ...DEFAULT_SETTINGS.rules,
        ...body.rules
      },
      llm: {
        ...DEFAULT_SETTINGS.llm,
        ...body.llm
      },
      ui: {
        ...DEFAULT_SETTINGS.ui,
        ...body.ui
      },
      privacy: {
        ...DEFAULT_SETTINGS.privacy,
        ...body.privacy
      }
    };

    // 実際のアプリケーションでは、ここでデータベースやファイルに設定を保存
    // 今回は成功レスポンスのみ返す
    
    // ログとレスポンス用にAPIキーをマスクした安全な設定を作成
    const safeSettings = createSafeSettings(settings);
    console.log('設定が保存されました:', safeSettings);
    
    return NextResponse.json({
      success: true,
      data: {
        saved: true,
        settings: safeSettings
      }
    });

  } catch (error) {
    console.error('Settings POST API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '設定の保存に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * 設定の検証
 */
function validateSettings(settings: Partial<AppSettings>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // analysis の検証
  if (settings.analysis) {
    if (settings.analysis.trigger && !['manual', 'auto'].includes(settings.analysis.trigger)) {
      errors.push('analysis.trigger は "manual" または "auto" である必要があります');
    }
    if (settings.analysis.autoDelay !== undefined && (settings.analysis.autoDelay < 100 || settings.analysis.autoDelay > 5000)) {
      errors.push('analysis.autoDelay は 100-5000 の範囲である必要があります');
    }
    if (settings.analysis.maxSentenceLength !== undefined && (settings.analysis.maxSentenceLength < 50 || settings.analysis.maxSentenceLength > 1000)) {
      errors.push('analysis.maxSentenceLength は 50-1000 の範囲である必要があります');
    }
  }

  // rules の検証
  if (settings.rules) {
    if (settings.rules.activeRuleset && typeof settings.rules.activeRuleset !== 'string') {
      errors.push('rules.activeRuleset は文字列である必要があります');
    }
    if (settings.rules.disabledRules && !Array.isArray(settings.rules.disabledRules)) {
      errors.push('rules.disabledRules は配列である必要があります');
    }
  }

  // llm の検証
  if (settings.llm) {
    if (settings.llm.enabled !== undefined && typeof settings.llm.enabled !== 'boolean') {
      errors.push('llm.enabled は boolean である必要があります');
    }
    
    // baseUrl の検証（文字列型チェック + URL形式チェック）
    if (settings.llm.baseUrl) {
      if (typeof settings.llm.baseUrl !== 'string') {
        errors.push('llm.baseUrl は文字列である必要があります');
      } else {
        try {
          const url = new URL(settings.llm.baseUrl);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            errors.push('llm.baseUrl は http: または https: プロトコルである必要があります');
          }
        } catch (urlError) {
          errors.push('llm.baseUrl は有効なURL形式である必要があります');
        }
      }
    }
    
    // apiKey の検証
    if (settings.llm.apiKey !== undefined && typeof settings.llm.apiKey !== 'string') {
      errors.push('llm.apiKey は文字列である必要があります');
    }
    
    if (settings.llm.timeout !== undefined && (settings.llm.timeout < 1000 || settings.llm.timeout > 60000)) {
      errors.push('llm.timeout は 1000-60000 の範囲である必要があります');
    }
    if (settings.llm.maxSuggestions !== undefined && (settings.llm.maxSuggestions < 1 || settings.llm.maxSuggestions > 10)) {
      errors.push('llm.maxSuggestions は 1-10 の範囲である必要があります');
    }
  }

  // ui の検証
  if (settings.ui) {
    if (settings.ui.theme && !['light', 'dark'].includes(settings.ui.theme)) {
      errors.push('ui.theme は "light" または "dark" である必要があります');
    }
    if (settings.ui.fontSize && !['small', 'medium', 'large'].includes(settings.ui.fontSize)) {
      errors.push('ui.fontSize は "small", "medium", "large" のいずれかである必要があります');
    }
    if (settings.ui.fontFamily && !['monospace', 'sans-serif'].includes(settings.ui.fontFamily)) {
      errors.push('ui.fontFamily は "monospace" または "sans-serif" である必要があります');
    }
  }

  // privacy の検証
  if (settings.privacy) {
    if (settings.privacy.allowExternalRequests !== undefined && typeof settings.privacy.allowExternalRequests !== 'boolean') {
      errors.push('privacy.allowExternalRequests は boolean である必要があります');
    }
    if (settings.privacy.logAnalytics !== undefined && typeof settings.privacy.logAnalytics !== 'boolean') {
      errors.push('privacy.logAnalytics は boolean である必要があります');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
