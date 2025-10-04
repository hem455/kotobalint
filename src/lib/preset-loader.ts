import fs from 'fs/promises';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import yaml from 'js-yaml';
import type { Rule } from '@/types';

/**
 * プリセットメタデータ
 */
export interface PresetMetadata {
  id: string;
  version: string;
  locale: string;
  name: string;
  description: string;
  basedOn?: string;
  performance: 'fast' | 'balanced' | 'thorough';
  targetUseCase: string;
  includesPresets?: string[];
}

/**
 * プリセット設定
 */
export interface PresetConfig {
  meta: PresetMetadata;
  rules: Rule[];
}

/**
 * ファイル相対パスでデフォルトのpresetsディレクトリを取得
 */
function getDefaultPresetsDir(): string {
  // ESM環境ではimport.meta.urlを使用、CJS環境では相対パスフォールバック
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // src/lib から src/rules/presets へ
    return path.join(__dirname, '..', 'rules', 'presets');
  }
  // フォールバック: process.cwd() からの相対パス
  return path.join(process.cwd(), 'src', 'rules', 'presets');
}

/**
 * プリセットローダー
 * YAMLファイルからルールプリセットを読み込む
 */
export class PresetLoader {
  private presetsCache: Map<string, PresetConfig> = new Map();
  private presetsDir: string;

  constructor(presetsDir?: string) {
    this.presetsDir = presetsDir || getDefaultPresetsDir();
  }

  /**
   * プリセット名からYAMLファイルを読み込む
   */
  async loadPreset(presetName: 'light' | 'standard' | 'strict'): Promise<PresetConfig> {
    // キャッシュチェック
    if (this.presetsCache.has(presetName)) {
      return this.presetsCache.get(presetName)!;
    }

    const filePath = path.join(this.presetsDir, `${presetName}-preset.yaml`);

    try {
      const fileContents = await fs.readFile(filePath, 'utf8');
      const data = yaml.load(fileContents) as PresetConfig;

      // バリデーション
      this.validatePresetConfig(data);

      // ルールに正規表現オブジェクトを生成
      const processedRules = data.rules.map(rule => this.processRule(rule));

      const config: PresetConfig = {
        meta: data.meta,
        rules: processedRules
      };

      // キャッシュに保存
      this.presetsCache.set(presetName, config);

      console.log(`プリセット "${presetName}" を読み込みました (${config.rules.length}ルール)`);
      return config;

    } catch (error) {
      console.error(`プリセット "${presetName}" の読み込みに失敗:`, error);
      throw new Error(`プリセット "${presetName}" の読み込みに失敗しました`);
    }
  }

  /**
   * 複数のプリセットを読み込み、マージする
   */
  async loadPresets(presetNames: Array<'light' | 'standard' | 'strict'>): Promise<Rule[]> {
    const allRules: Rule[] = [];
    const ruleMap = new Map<string, number>();

    for (const presetName of presetNames) {
      const config = await this.loadPreset(presetName);

      for (const rule of config.rules) {
        // 後勝ち: 既存のルールがあれば置き換える
        const existingIndex = ruleMap.get(rule.id);
        if (existingIndex !== undefined) {
          allRules[existingIndex] = rule;
        } else {
          ruleMap.set(rule.id, allRules.length);
          allRules.push(rule);
        }
      }
    }

    return allRules;
  }

  /**
   * カスタムプリセットパスから読み込む
   */
  async loadCustomPreset(filePath: string): Promise<PresetConfig> {
    try {
      const fileContents = await fs.readFile(filePath, 'utf8');
      const data = yaml.load(fileContents) as PresetConfig;

      this.validatePresetConfig(data);

      const processedRules = data.rules.map(rule => this.processRule(rule));

      return {
        meta: data.meta,
        rules: processedRules
      };

    } catch (error) {
      console.error(`カスタムプリセット "${filePath}" の読み込みに失敗:`, error);
      throw new Error(`カスタムプリセットの読み込みに失敗しました`);
    }
  }

  /**
   * ルールを処理（正規表現の変換など）
   */
  private processRule(rule: any): Rule {
    // pattern が文字列の場合、正規表現に変換するかそのままにするか判定
    let pattern: string | RegExp = rule.pattern;

    // 正規表現特殊文字が含まれている場合は RegExp に変換
    if (typeof rule.pattern === 'string' && this.isRegexPattern(rule.pattern)) {
      try {
        pattern = new RegExp(rule.pattern, 'g');
      } catch (error) {
        console.warn(`無効な正規表現パターン: ${rule.pattern}`, error);
        // エラー時は文字列のまま保持
        pattern = rule.pattern;
      }
    }

    return {
      id: rule.id,
      severity: rule.severity,
      category: rule.category,
      pattern,
      message: rule.message,
      autoFix: rule.autoFix || false,
      replacement: rule.replacement,
      examples: rule.examples || [],
      enabled: rule.enabled !== false, // デフォルトは true
      source: rule.source
    } as Rule;
  }

  /**
   * 文字列が正規表現パターンかどうかを判定
   */
  private isRegexPattern(pattern: string): boolean {
    // 正規表現特殊文字が含まれている場合は正規表現として扱う
    const regexChars = /[\^$.*+?()[\]{}|\\]/;
    return regexChars.test(pattern);
  }

  /**
   * プリセット設定のバリデーション
   */
  private validatePresetConfig(config: any): void {
    if (!config.meta) {
      throw new Error('プリセット設定に meta フィールドが必要です');
    }

    if (!config.meta.id || !config.meta.name) {
      throw new Error('プリセットのメタデータに id と name が必要です');
    }

    if (!Array.isArray(config.rules)) {
      throw new Error('プリセット設定に rules 配列が必要です');
    }

    // 各ルールの必須フィールドをチェック
    config.rules.forEach((rule: any, index: number) => {
      if (!rule.id || !rule.severity || !rule.category || !rule.pattern || !rule.message) {
        throw new Error(`ルール ${index + 1} に必須フィールドが不足しています`);
      }
    });
  }

  /**
   * 利用可能なプリセット一覧を取得（同期的な列挙が必要なため readdirSync を使用）
   */
  getAvailablePresets(): Array<{ name: string; meta: PresetMetadata }> {
    const presets: Array<{ name: string; meta: PresetMetadata }> = [];

    try {
      const files = readdirSync(this.presetsDir);

      for (const file of files) {
        if (file.endsWith('-preset.yaml')) {
          const presetName = file.replace('-preset.yaml', '');
          const filePath = path.join(this.presetsDir, file);

          try {
            // この同期読み込みは初期化時のみで、パフォーマンスへの影響は限定的
            const fileContents = require('fs').readFileSync(filePath, 'utf8');
            const data = yaml.load(fileContents) as PresetConfig;

            if (data.meta) {
              presets.push({
                name: presetName,
                meta: data.meta
              });
            }
          } catch (error) {
            console.warn(`プリセット "${file}" のメタデータ読み込みに失敗:`, error);
          }
        }
      }

    } catch (error) {
      console.error('プリセットディレクトリの読み込みに失敗:', error);
    }

    return presets;
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.presetsCache.clear();
  }

  /**
   * プリセットの統計情報を取得
   */
  async getPresetStats(presetName: 'light' | 'standard' | 'strict'): Promise<{
    totalRules: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    autoFixableCount: number;
  }> {
    const config = await this.loadPreset(presetName);

    const stats = {
      totalRules: config.rules.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      autoFixableCount: 0
    };

    config.rules.forEach(rule => {
      // カテゴリ別集計
      stats.byCategory[rule.category] = (stats.byCategory[rule.category] || 0) + 1;

      // 重要度別集計
      stats.bySeverity[rule.severity] = (stats.bySeverity[rule.severity] || 0) + 1;

      // 自動修正可能数
      if (rule.autoFix) {
        stats.autoFixableCount++;
      }
    });

    return stats;
  }
}

/**
 * デフォルトのプリセットローダーインスタンス
 */
export const defaultPresetLoader = new PresetLoader();
