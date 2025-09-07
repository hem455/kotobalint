import * as fs from 'fs';
import * as path from 'path';
import { YamlRuleParser } from './yaml-rule-parser';
import { RuleEngine } from './rule-engine';
import type {
  YamlRuleFile,
  Rule,
  RuleCompilationResult,
  RuleEngineResult,
  RuleEngineConfig
} from '@/types';

/**
 * ルール管理マネージャー
 * YAMLルールファイルの読み込み・管理・ルールエンジンへの適用を行う
 */
export class RuleManager {
  private ruleEngine: RuleEngine;
  private loadedRuleFiles: Map<string, YamlRuleFile> = new Map();
  private ruleSets: Map<string, Rule[]> = new Map();
  private currentRuleSetId: string | null = null;

  constructor(ruleEngine?: RuleEngine) {
    this.ruleEngine = ruleEngine || new RuleEngine();
  }

  /**
   * YAMLルールファイルを読み込んでルールエンジンに登録
   */
  async loadRuleFile(filePath: string, ruleSetId?: string): Promise<{
    success: boolean;
    errors?: string[];
    warnings?: string[];
    loadedRules?: number;
  }> {
    try {
      // ファイルの存在確認と読み取り権限チェック
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          return {
            success: false,
            errors: [`ルールファイルが見つかりません: ${filePath}`]
          };
        } else {
          return {
            success: false,
            errors: [`ルールファイルにアクセスできません: ${filePath} (${err.message})`]
          };
        }
      }

      // ファイル読み込み
      const content = fs.readFileSync(filePath, 'utf-8');

      // YAML解析
      const parseResult = YamlRuleParser.parseYamlFile(content);
      if (!parseResult.success) {
        return {
          success: false,
          errors: parseResult.errors,
          warnings: parseResult.warnings
        };
      }

      if (!parseResult.data) {
        return {
          success: false,
          errors: ['YAMLファイルの解析に失敗しました']
        };
      }

      const yamlRuleFile = parseResult.data;
      const fileId = ruleSetId || yamlRuleFile.meta.id;

      // ルールコンパイル
      const compilationResults = YamlRuleParser.compileRuleFile(yamlRuleFile);
      const compiledRules: Rule[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      compilationResults.forEach((result, index) => {
        if (result.success && result.rule) {
          compiledRules.push(result.rule);
        } else {
          errors.push(...(result.errors || []));
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      });

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings
        };
      }

      // ルールエンジンに登録
      this.ruleEngine.addRules(compiledRules);

      // 管理データ保存
      this.loadedRuleFiles.set(fileId, yamlRuleFile);
      this.ruleSets.set(fileId, compiledRules);

      return {
        success: true,
        loadedRules: compiledRules.length,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        errors: [`ルールファイル読み込みエラー: ${error instanceof Error ? error.message : '不明なエラー'}`]
      };
    }
  }

  /**
   * ディレクトリ内の全てのYAMLルールファイルを読み込み
   */
  async loadRuleDirectory(directoryPath: string): Promise<{
    success: boolean;
    loadedFiles: number;
    loadedRules: number;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      if (!fs.existsSync(directoryPath)) {
        return {
          success: false,
          loadedFiles: 0,
          loadedRules: 0,
          errors: [`ディレクトリが見つかりません: ${directoryPath}`]
        };
      }

      const files = fs.readdirSync(directoryPath);
      const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));

      let totalLoadedRules = 0;
      const allErrors: string[] = [];
      const allWarnings: string[] = [];

      for (const file of yamlFiles) {
        const filePath = path.join(directoryPath, file);
        const result = await this.loadRuleFile(filePath);

        if (result.success && result.loadedRules) {
          totalLoadedRules += result.loadedRules;
        }

        if (result.errors) {
          allErrors.push(...result.errors.map(error => `${file}: ${error}`));
        }

        if (result.warnings) {
          allWarnings.push(...result.warnings.map(warning => `${file}: ${warning}`));
        }
      }

      return {
        success: allErrors.length === 0,
        loadedFiles: yamlFiles.length,
        loadedRules: totalLoadedRules,
        errors: allErrors.length > 0 ? allErrors : undefined,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        loadedFiles: 0,
        loadedRules: 0,
        errors: [`ディレクトリ読み込みエラー: ${error instanceof Error ? error.message : '不明なエラー'}`]
      };
    }
  }

  /**
   * テキストを解析
   */
  async analyzeText(text: string, config?: Partial<RuleEngineConfig>): Promise<RuleEngineResult> {
    return this.ruleEngine.analyzeText(text, config);
  }

  /**
   * ルールセットを切り替え
   */
  switchRuleSet(ruleSetId: string): boolean {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      this.currentRuleSetId = null;
      return false;
    }

    // 現在のルールをクリア
    this.ruleEngine.clearRules();

    // 新しいルールセットを登録
    this.ruleEngine.addRules(ruleSet);

    // 現在のルールセットIDを更新
    this.currentRuleSetId = ruleSetId;
    return true;
  }

  /**
   * 現在のルールセットIDを取得
   */
  getCurrentRuleSetId(): string | null {
    return this.currentRuleSetId;
  }

  /**
   * 利用可能なルールセット一覧を取得
   */
  getAvailableRuleSets(): string[] {
    return Array.from(this.ruleSets.keys());
  }

  /**
   * 現在のルールセットを取得
   */
  getCurrentRuleSet(): Rule[] {
    return this.ruleEngine.getRegisteredRules();
  }

  /**
   * ルールセットの統計情報を取得
   */
  getRuleSetStats(): {
    totalRuleSets: number;
    totalRules: number;
    rulesByCategory: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  } {
    const allRules = Array.from(this.ruleSets.values()).flat();

    const rulesByCategory: Record<string, number> = {};
    const rulesBySeverity: Record<string, number> = {};

    allRules.forEach(rule => {
      rulesByCategory[rule.category] = (rulesByCategory[rule.category] || 0) + 1;
      rulesBySeverity[rule.severity] = (rulesBySeverity[rule.severity] || 0) + 1;
    });

    return {
      totalRuleSets: this.ruleSets.size,
      totalRules: allRules.length,
      rulesByCategory,
      rulesBySeverity
    };
  }

  /**
   * 指定されたルールセットのルール数を取得
   */
  getRuleSetRuleCount(ruleSetId: string): number {
    const ruleSet = this.ruleSets.get(ruleSetId);
    return ruleSet ? ruleSet.length : 0;
  }

  /**
   * ルールを有効/無効化
   */
  enableRule(ruleId: string, enabled: boolean): boolean {
    let ruleUpdated = false;

    // 全ルールセットから該当ルールを探して全て更新
    for (const ruleSet of Array.from(this.ruleSets.values())) {
      const rule = ruleSet.find((r: Rule) => r.id === ruleId);
      if (rule) {
        rule.enabled = enabled;

        // ルールエンジンにも反映
        if (enabled) {
          this.ruleEngine.addRule(rule);
        } else {
          this.ruleEngine.removeRule(ruleId);
        }

        ruleUpdated = true;
      }
    }

    return ruleUpdated;
  }

  /**
   * ルールエンジンの設定を取得
   */
  getEngineConfig(): RuleEngineConfig {
    return this.ruleEngine.getConfig();
  }

  /**
   * ルールエンジンの設定を更新
   */
  updateEngineConfig(config: Partial<RuleEngineConfig>): void {
    this.ruleEngine.updateConfig(config);
  }

  /**
   * デバッグ情報を取得
   */
  getDebugInfo(): {
    loadedRuleFiles: string[];
    currentRules: number;
    engineConfig: RuleEngineConfig;
    stats: ReturnType<RuleManager['getRuleSetStats']>;
  } {
    return {
      loadedRuleFiles: Array.from(this.loadedRuleFiles.keys()),
      currentRules: this.ruleEngine.getRuleCount(),
      engineConfig: this.ruleEngine.getConfig(),
      stats: this.getRuleSetStats()
    };
  }
}
