import { NextRequest, NextResponse } from 'next/server';
import { RuleEngine } from '@/lib/rule-engine';
import { defaultPresetLoader } from '@/lib/preset-loader';
import type { ApiResponse } from '@/types';

export const runtime = "nodejs";

/**
 * リクエストボディの型定義
 */
interface AnalyzeRequest {
  text: string;
  preset?: 'light' | 'standard' | 'strict';
  enabledCategories?: string[];
  enabledSeverities?: string[];
}

/**
 * レスポンスボディの型定義
 */
interface AnalyzeResponse {
  issues: any[];
  meta: {
    elapsedMs: number;
    preset: string;
    rulesApplied: number;
    issuesFound: number;
  };
}

/**
 * POST /api/analyze - ルールベースのテキスト解析（プリセット対応）
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AnalyzeResponse>>> {
  const startTime = Date.now();

  try {
    // リクエストボディの解析
    const body: AnalyzeRequest = await request.json();

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

    // プリセットの決定（デフォルトは standard）
    const preset = body.preset || 'standard';

    // プリセットマッピング（累積的）
    const presetMapping: Record<string, Array<'light' | 'standard' | 'strict'>> = {
      'light': ['light'],
      'standard': ['light', 'standard'],
      'strict': ['light', 'standard', 'strict']
    };

    // プリセットローダーから累積的にルールを読み込む
    console.log(`プリセット "${preset}" を読み込み中...`);
    console.log(`  - 累積構成: ${presetMapping[preset].join(' + ')}`);
    const rules = await defaultPresetLoader.loadPresets(presetMapping[preset]);
    console.log(`  - 合計ルール数: ${rules.length}`);

    // ルールエンジンの初期化
    const engine = new RuleEngine();
    engine.addRules(rules);

    console.log(`ルールエンジン初期化完了: ${engine.getRuleCount()}ルール`);
    console.log('最初の3ルール:');
    rules.slice(0, 3).forEach(r => {
      console.log(`  - ${r.id}: pattern=${r.pattern instanceof RegExp ? 'RegExp' : typeof r.pattern}, enabled=${r.enabled}`);
    });
    console.log('解析対象テキスト:', body.text);

    // テキスト解析の実行
    const result = await engine.analyzeText(body.text, {
      enabledCategories: body.enabledCategories,
      enabledSeverities: body.enabledSeverities,
      maxIssues: 100,
      timeout: 5000
    });

    console.log(`解析完了: ${result.issues.length}個の問題を検出`);
    
    // デバッグ: 各 issue の詳細をログ出力
    result.issues.forEach((issue, idx) => {
      console.log(`Issue #${idx + 1}:`, {
        id: issue.id,
        range: issue.range,
        message: issue.message,
        matchedText: body.text.slice(issue.range.start, issue.range.end),
        suggestions: issue.suggestions?.map(s => s.text)
      });
    });

    // レスポンスの構築
    return NextResponse.json({
      success: true,
      data: {
        issues: result.issues,
        meta: {
          elapsedMs: Date.now() - startTime,
          preset,
          rulesApplied: result.matchedRules.length,
          issuesFound: result.issues.length
        }
      }
    });

  } catch (error) {
    console.error('Analyze API エラー:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'テキスト解析に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/analyze - 利用可能なプリセット情報を取得
 */
export async function GET(): Promise<NextResponse> {
  try {
    const presets = defaultPresetLoader.getAvailablePresets();

    // 各プリセットの統計情報を取得
    const presetsWithStats = await Promise.all(
      ['light', 'standard', 'strict'].map(async (name) => {
        const stats = await defaultPresetLoader.getPresetStats(name as 'light' | 'standard' | 'strict');
        const preset = presets.find(p => p.name === name);

        return {
          name,
          meta: preset?.meta,
          stats
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        presets: presetsWithStats
      }
    });

  } catch (error) {
    console.error('プリセット情報取得エラー:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'プリセット情報の取得に失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      }
    }, { status: 500 });
  }
}
