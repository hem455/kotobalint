import { NextRequest, NextResponse } from 'next/server';
import { RuleManager } from '@/lib/rule-manager';
import type { ApiResponse } from '@/types';

// ルールマネージャーのシングルトンインスタンス
let ruleManager: RuleManager | null = null;

/**
 * ルールマネージャーを初期化
 */
async function initializeRuleManager(): Promise<RuleManager> {
  if (!ruleManager) {
    ruleManager = new RuleManager();
    
    // デフォルトのルールファイルを読み込み
    try {
      const result = await ruleManager.loadRuleFile('src/rules/japanese-standard-rules.yaml', 'japanese-standard');
      if (!result.success) {
        console.warn('デフォルトルールファイルの読み込みに失敗:', result.errors);
        ruleManager = null;
      }
    } catch (error) {
      console.warn('ルールファイルの読み込みエラー:', error);
      ruleManager = null;
    }
  }
  
  if (!ruleManager) {
    throw new Error('ルールマネージャーの初期化に失敗しました');
  }
  return ruleManager;
}

/**
 * PATCH /api/rules/[ruleId] - 個別ルールの有効/無効切り替え
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
): Promise<NextResponse<ApiResponse<{
  ruleId: string;
  enabled: boolean;
  updated: boolean;
}>>> {
  try {
    const { ruleId } = params;
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON'
        }
      }, { status: 400 });
    }
    
    const { enabled } = body;
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'enabled プロパティが boolean で指定されていません'
        }
      }, { status: 400 });
    }

    const manager = await initializeRuleManager();
    const updated = manager.enableRule(ruleId, enabled);
    
    if (!updated) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RULE_NOT_FOUND',
          message: `指定されたルールが見つかりません: ${ruleId}`
        }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        enabled,
        updated: true
      }
    });

  } catch (error) {
    console.error('Rule update API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '内部サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/rules/[ruleId] - 個別ルールの詳細情報を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
): Promise<NextResponse<ApiResponse<{
  rule: any;
  found: boolean;
}>>> {
  try {
    const { ruleId } = params;
    const manager = await initializeRuleManager();
    const currentRules = manager.getCurrentRuleSet();
    
    const rule = currentRules.find(r => r.id === ruleId);
    
    if (!rule) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RULE_NOT_FOUND',
          message: `指定されたルールが見つかりません: ${ruleId}`
        }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        rule,
        found: true
      }
    });

  } catch (error) {
    console.error('Rule detail API エラー:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '内部サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}
