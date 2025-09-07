import { NextRequest, NextResponse } from 'next/server';
import { RuleManager } from '@/lib/rule-manager';
import type { LintRequest, LintResponse, ApiResponse } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

// ルールマネージャーのシングルトンインスタンス
let ruleManager: RuleManager | null = null;

/**
 * ルールファイルパスを取得し、存在と読み取り可能性を検証
 */
async function getRuleFilePath(): Promise<string> {
  // 環境変数からルールファイルパスを取得、デフォルト値を設定
  const rulesFilePath = process.env.RULES_FILE_PATH || 'src/rules/japanese-standard-rules.yaml';
  
  // パスを解決（相対パスの場合はプロジェクトルートからの相対パスとして扱う）
  const resolvedPath = path.isAbsolute(rulesFilePath) 
    ? rulesFilePath 
    : path.resolve(process.cwd(), rulesFilePath);
  
  try {
    // ファイルの存在確認
    await fs.access(resolvedPath, fs.constants.F_OK);
    
    // ファイルの読み取り可能性確認
    await fs.access(resolvedPath, fs.constants.R_OK);
    
    console.log(`ルールファイルパスを解決しました: ${resolvedPath}`);
    return resolvedPath;
    
  } catch (error) {
    const errorMessage = `ルールファイルが見つからないか読み取れません: ${resolvedPath}`;
    console.error(errorMessage, error);
    throw new Error(`${errorMessage} - ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

/**
 * ルールマネージャーを初期化
 */
async function initializeRuleManager(): Promise<RuleManager> {
  if (!ruleManager) {
    ruleManager = new RuleManager();
    
    // ルールファイルパスを取得し、ファイルを読み込み
    try {
      const ruleFilePath = await getRuleFilePath();
      const result = await ruleManager.loadRuleFile(ruleFilePath, 'japanese-standard');
      
      if (!result.success) {
        const errorMessage = `ルールファイルの読み込みに失敗しました: ${ruleFilePath}`;
        console.error(errorMessage, result.errors);
        throw new Error(`${errorMessage} - ${result.errors?.join(', ')}`);
      }
      
      console.log(`ルールファイルを正常に読み込みました: ${ruleFilePath}`);
      
    } catch (error) {
      const errorMessage = 'ルールファイルの初期化に失敗しました';
      console.error(errorMessage, error);
      throw new Error(`${errorMessage} - ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  }
  
  return ruleManager;
}

/**
 * POST /api/lint - テキストの校正解析
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<LintResponse>>> {
  const startTime = Date.now();
  
  try {
    // リクエストボディの解析
    const body: LintRequest = await request.json();
    
    // バリデーション
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'テキストが指定されていません'
        }
      }, { status: 400 });
    }

    // 文字数制限チェック（2000文字）
    if (body.text.length > 2000) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TEXT_TOO_LONG',
          message: 'テキストが長すぎます（最大2000文字）'
        }
      }, { status: 400 });
    }

    // ルールマネージャーの初期化
    let manager: RuleManager;
    try {
      manager = await initializeRuleManager();
    } catch (error) {
      console.error('ルールマネージャーの初期化に失敗:', error);
      return NextResponse.json({
        success: false,
        error: {
          code: 'RULES_INITIALIZATION_FAILED',
          message: 'ルールファイルの初期化に失敗しました'
        }
      }, { status: 500 });
    }
    
    // ルールセットの切り替え（指定されている場合）
    if (body.ruleset) {
      const switched = manager.switchRuleSet(body.ruleset);
      if (!switched) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'RULESET_NOT_FOUND',
            message: `指定されたルールセットが見つかりません: ${body.ruleset}`
          }
        }, { status: 404 });
      }
    }

    // 解析オプションの設定（デフォルトとリクエストオプションをマージ）
    const defaultOptions = {
      maxIssues: 100,
      timeout: 5000,
      enabledCategories: ['style', 'grammar', 'honorific', 'consistency', 'risk'] as ('style' | 'grammar' | 'honorific' | 'consistency' | 'risk')[],
      enabledSeverities: ['info', 'warn', 'error'] as ('info' | 'warn' | 'error')[],
      excludeRules: [] as string[]
    };

    // リクエストオプションの検証と正規化
    const requestOptions = body.options || {};
    const validatedOptions = {
      maxIssues: typeof requestOptions.maxIssues === 'number' && requestOptions.maxIssues > 0 
        ? requestOptions.maxIssues 
        : defaultOptions.maxIssues,
      timeout: typeof requestOptions.timeout === 'number' && requestOptions.timeout > 0 
        ? requestOptions.timeout 
        : defaultOptions.timeout,
      includeSuggestions: typeof requestOptions.includeSuggestions === 'boolean' 
        ? requestOptions.includeSuggestions 
        : true
    };

    // デフォルトオプションとリクエストオプションをマージ
    const config = {
      maxIssues: validatedOptions.maxIssues,
      timeout: validatedOptions.timeout,
      enabledCategories: defaultOptions.enabledCategories,
      enabledSeverities: defaultOptions.enabledSeverities,
      excludeRules: defaultOptions.excludeRules
    };

    // テキスト解析の実行
    const result = await manager.analyzeText(body.text, config);
    
    // 提案の生成とカウント（オプション）
    let suggestionsGenerated = 0;
    if (validatedOptions.includeSuggestions === false) {
      // 提案が無効化されている場合、既存の提案をクリア
      result.issues.forEach(issue => {
        issue.suggestions = [];
      });
    } else {
      // 提案が有効な場合（デフォルトまたは明示的にtrue）、提案をカウント
      result.issues.forEach(issue => {
        if (issue.suggestions && issue.suggestions.length > 0) {
          suggestionsGenerated += issue.suggestions.length;
        }
      });
    }

    // レスポンスの構築
    const response: LintResponse = {
      issues: result.issues,
      meta: {
        elapsedMs: Date.now() - startTime,
        textLength: result.textLength,
        rulesetId: manager.getCurrentRuleSetId() || 'default',
        processingStats: {
          rulesProcessed: result.matchedRules.length,
          suggestionsGenerated
        }
      }
    };

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    // サーバーサイドでの詳細ログ（本番環境でも記録）
    const errorDetails = {
      message: error instanceof Error ? error.message : '不明なエラー',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      endpoint: '/api/lint'
    };
    console.error('Lint API エラー:', errorDetails);
    
    // クライアントへのレスポンス（本番環境では機密情報を除外）
    const isProduction = process.env.NODE_ENV === 'production';
    const clientError = {
      code: 'INTERNAL_ERROR',
      message: '内部サーバーエラーが発生しました',
      ...(isProduction ? {} : {
        details: error instanceof Error ? error.message : '不明なエラー'
      })
    };
    
    return NextResponse.json({
      success: false,
      error: clientError
    }, { status: 500 });
  }
}

/**
 * GET /api/lint - ヘルスチェック
 */
export async function GET(): Promise<NextResponse<ApiResponse<{ status: string; rulesLoaded: number }>>> {
  try {
    const manager = await initializeRuleManager();
    const stats = manager.getRuleSetStats();
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        rulesLoaded: stats.totalRules
      }
    });
  } catch (error) {
    console.error('ヘルスチェック中にエラーが発生:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'サービスが利用できません'
      }
    }, { status: 503 });
  }
}
