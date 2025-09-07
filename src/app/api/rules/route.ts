import { NextRequest, NextResponse } from 'next/server';
import { RuleManager } from '@/lib/rule-manager';
import type { Rule, ApiResponse } from '@/types';

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
      }
    } catch (error) {
      console.warn('ルールファイルの読み込みエラー:', error);
    }
  }
  
  return ruleManager;
}

/**
 * GET /api/rules - ルールセット一覧とルール管理情報を取得
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{
  ruleSets: Array<{
    id: string;
    name: string;
    description?: string;
    ruleCount: number;
    isActive: boolean;
  }>;
  currentRuleSet: {
    id: string | null;
    rules: Rule[];
  };
  stats: {
    totalRuleSets: number;
    totalRules: number;
    rulesByCategory: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  };
}>>> {
  try {
    const manager = await initializeRuleManager();
    
    // 利用可能なルールセット一覧
    const availableRuleSets = manager.getAvailableRuleSets();
    const currentRuleSetId = manager.getCurrentRuleSetId();
    const currentRules = manager.getCurrentRuleSet();
    const stats = manager.getRuleSetStats();
    
    // ルールセット情報の構築
    const ruleSets = availableRuleSets.map(id => ({
      id,
      name: id === 'japanese-standard' ? '日本語標準ルール' : id,
      description: id === 'japanese-standard' ? '日本語校正のための標準ルールセット' : undefined,
      ruleCount: manager.getRuleSetRuleCount(id),
      isActive: id === currentRuleSetId
    }));

    return NextResponse.json({
      success: true,
      data: {
        ruleSets,
        currentRuleSet: {
          id: currentRuleSetId,
          rules: currentRules
        },
        stats
      }
    });

  } catch (error) {
    console.error('Rules API エラー:', error);
    
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
 * POST /api/rules - ルールセットの切り替え
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{
  switched: boolean;
  currentRuleSetId: string | null;
  ruleCount: number;
}>>> {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON解析エラー:', parseError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'リクエストボディのJSON解析に失敗しました'
        }
      }, { status: 400 });
    }

    const { ruleSetId } = body;
    
    if (!ruleSetId || typeof ruleSetId !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'ルールセットIDが指定されていません'
        }
      }, { status: 400 });
    }

    const manager = await initializeRuleManager();
    const switched = manager.switchRuleSet(ruleSetId);
    
    if (!switched) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RULESET_NOT_FOUND',
          message: `指定されたルールセットが見つかりません: ${ruleSetId}`
        }
      }, { status: 404 });
    }

    const currentRules = manager.getCurrentRuleSet();
    
    return NextResponse.json({
      success: true,
      data: {
        switched: true,
        currentRuleSetId: ruleSetId,
        ruleCount: currentRules.length
      }
    });

  } catch (error) {
    console.error('Rules switch API エラー:', error);
    
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
