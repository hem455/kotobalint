import * as path from 'path';
import { RuleManager } from './rule-manager';

/**
 * ルールシステムのテスト関数
 */
export async function testRuleSystem(): Promise<void> {
  console.log('🔍 日本語校正ルールシステムテスト開始...\n');

  const ruleManager = new RuleManager();

  try {
    // 1. ルールファイル読み込みテスト
    console.log('📁 ルールファイル読み込みテスト...');
    const ruleFilePath = path.join(process.cwd(), 'src/rules/japanese-standard-rules.yaml');

    const loadResult = await ruleManager.loadRuleFile(ruleFilePath, 'japanese-standard');
    if (loadResult.success) {
      console.log(`✅ ルールファイル読み込み成功: ${loadResult.loadedRules}個のルールを読み込みました`);
      if (loadResult.warnings) {
        console.log(`⚠️ 警告: ${loadResult.warnings.join(', ')}`);
      }
    } else {
      console.log(`❌ ルールファイル読み込み失敗: ${loadResult.errors?.join(', ')}`);
      return;
    }

    // 2. 統計情報表示
    console.log('\n📊 ルール統計情報:');
    const stats = ruleManager.getRuleSetStats();
    console.log(`- 総ルール数: ${stats.totalRules}`);
    console.log(`- カテゴリ別:`, stats.rulesByCategory);
    console.log(`- 重要度別:`, stats.rulesBySeverity);

    // 3. サンプルテキスト解析テスト
    console.log('\n🔍 テキスト解析テスト...');

    const testTexts = [
      {
        name: 'ら抜き言葉テスト',
        text: 'この資料を見れる人は限られています。'
      },
      {
        name: '二重敬語テスト',
        text: 'お電話差し上げますので、お待ちください。'
      },
      {
        name: '冗長表現テスト',
        text: 'このプロジェクトを行うことができるのはあなただけです。'
      },
      {
        name: '長文テスト',
        text: 'これは非常に長い文章です。この文章は100文字以上ありますので、スタイルチェッカーが警告を発するはずです。文章が長すぎると読みにくくなる可能性があります。'
      }
    ];

    for (const testCase of testTexts) {
      console.log(`\n--- ${testCase.name} ---`);
      console.log(`テキスト: "${testCase.text}"`);

      const result = await ruleManager.analyzeText(testCase.text);
      console.log(`検出された問題: ${result.issues.length}個`);
      console.log(`処理時間: ${result.processingTime}ms`);

      if (result.issues.length > 0) {
        result.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. [${issue.severity}] ${issue.message}`);
          console.log(`     位置: ${issue.range.start}-${issue.range.end}`);
          if (issue.suggestions.length > 0) {
            console.log(`     修正提案: ${issue.suggestions[0].text}`);
          }
        });
      } else {
        console.log('  ✅ 問題なし');
      }
    }

    // 4. デバッグ情報表示
    console.log('\n🔧 デバッグ情報:');
    const debugInfo = ruleManager.getDebugInfo();
    console.log(`- 読み込まれたルールファイル: ${debugInfo.loadedRuleFiles.join(', ')}`);
    console.log(`- 現在のルール数: ${debugInfo.currentRules}`);
    console.log(`- エンジン設定:`, debugInfo.engineConfig);

    console.log('\n✅ テスト完了！');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// コマンドラインから実行された場合のみテストを実行
if (require.main === module) {
  testRuleSystem().catch(console.error);
}
