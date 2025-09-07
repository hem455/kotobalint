import * as yaml from 'js-yaml';
import type {
  YamlRuleFile,
  YamlRule,
  YamlParseResult,
  RuleCompilationResult,
  Rule,
  IssueSeverity,
  IssueCategory,
  RuleValidationResult
} from '@/types';

/**
 * YAMLルールファイルパーサー
 * YAML形式のルールファイルを解析し、TypeScriptオブジェクトに変換する
 */
export class YamlRuleParser {
  /**
   * YAMLデータ構造の型ガード
   */
  private static isValidYamlStructure(data: unknown): data is {
    meta: unknown;
    rules: unknown[];
  } {
    if (data === null || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return (
      'meta' in obj &&
      'rules' in obj &&
      Array.isArray(obj.rules)
    );
  }

  /**
   * YAMLファイルを解析してYamlRuleFileオブジェクトを生成
   */
  static parseYamlFile(content: string): YamlParseResult {
    try {
      const rawData = yaml.load(content) as unknown;

      // YAML構造の検証
      if (!this.isValidYamlStructure(rawData)) {
        return {
          success: false,
          errors: ['YAMLファイルの構造が正しくありません。metaとrulesフィールドが必要です。']
        };
      }

      // metaセクションの検証
      if (!rawData.meta || typeof rawData.meta !== 'object') {
        return {
          success: false,
          errors: ['metaセクションがありません']
        };
      }

      const meta = rawData.meta as Record<string, unknown>;
      const requiredMetaFields = ['id', 'version', 'locale', 'createdAt', 'author'];
      const missingMetaFields = requiredMetaFields.filter(field => !meta[field]);

      if (missingMetaFields.length > 0) {
        return {
          success: false,
          errors: [`metaセクションに必須フィールドが不足しています: ${missingMetaFields.join(', ')}`]
        };
      }

      // rulesセクションの検証
      if (!Array.isArray(rawData.rules)) {
        return {
          success: false,
          errors: ['rulesセクションが配列形式ではありません']
        };
      }

      // 各ルールの検証
      const validationResults = rawData.rules.map((rule: unknown, index: number) =>
        this.validateYamlRule(rule, index)
      );

      const errors: string[] = [];
      const warnings: string[] = [];

      validationResults.forEach((result, index) => {
        if (!result.isValid) {
          result.errors.forEach(error => {
            errors.push(`ルール ${index + 1}: ${error}`);
          });
        }
        result.warnings.forEach(warning => {
          warnings.push(`ルール ${index + 1}: ${warning}`);
        });
      });

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings
        };
      }

      const yamlRuleFile: YamlRuleFile = {
        meta: {
          id: meta.id as string,
          version: meta.version as string,
          locale: meta.locale as string,
          createdAt: meta.createdAt as string,
          updatedAt: (meta.updatedAt as string | undefined) || (meta.createdAt as string),
          author: meta.author as string,
          description: meta.description as string | undefined
        },
        rules: rawData.rules.map((rule: unknown) => {
          const ruleObj = rule as Record<string, unknown>;
          return {
            id: ruleObj.id as string,
            severity: ruleObj.severity as IssueSeverity,
            category: ruleObj.category as IssueCategory,
            pattern: ruleObj.pattern as string,
            message: ruleObj.message as string,
            autoFix: ruleObj.autoFix as boolean ?? false,
            replacement: ruleObj.replacement as string | undefined,
            examples: ruleObj.examples as any,
            enabled: ruleObj.enabled as boolean ?? true,
            metadata: ruleObj.metadata as any
          };
        })
      };

      return {
        success: true,
        data: yamlRuleFile,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        errors: [`YAML解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`]
      };
    }
  }

  /**
   * YAMLルールの検証
   */
  private static validateYamlRule(rule: unknown, index: number): RuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ルールがオブジェクトであることを確認
    if (!rule || typeof rule !== 'object') {
      errors.push('ルールはオブジェクトである必要があります');
      return { isValid: false, errors, warnings };
    }

    const ruleObj = rule as Record<string, unknown>;

    // 必須フィールドのチェック
    const requiredFields = ['id', 'severity', 'category', 'pattern', 'message'];
    const missingFields = requiredFields.filter(field => !ruleObj[field]);

    if (missingFields.length > 0) {
      errors.push(`必須フィールドが不足しています: ${missingFields.join(', ')}`);
      return { isValid: false, errors, warnings };
    }

    // severityの検証
    const validSeverities: IssueSeverity[] = ['info', 'warn', 'error'];
    if (!validSeverities.includes(ruleObj.severity as IssueSeverity)) {
      errors.push(`severityは以下のいずれかである必要があります: ${validSeverities.join(', ')}`);
    }

    // categoryの検証
    const validCategories: IssueCategory[] = ['style', 'grammar', 'honorific', 'consistency', 'risk'];
    if (!validCategories.includes(ruleObj.category as IssueCategory)) {
      errors.push(`categoryは以下のいずれかである必要があります: ${validCategories.join(', ')}`);
    }

    // patternの検証
    if (typeof ruleObj.pattern !== 'string' || (ruleObj.pattern as string).trim().length === 0) {
      errors.push('patternは空でない文字列である必要があります');
    }

    // messageの検証
    if (typeof ruleObj.message !== 'string' || (ruleObj.message as string).trim().length === 0) {
      errors.push('messageは空でない文字列である必要があります');
    }

    // autoFixがtrueの場合、replacementの検証
    if (ruleObj.autoFix === true && !ruleObj.replacement) {
      errors.push(`autoFixがtrueの場合、replacementを必須にしてください (ルールID: ${ruleObj.id || index + 1})`);
    }

    // examplesの検証
    if (ruleObj.examples) {
      if (!Array.isArray(ruleObj.examples)) {
        warnings.push('examplesは配列形式である必要があります');
      } else {
        ruleObj.examples.forEach((example: unknown, exampleIndex: number) => {
          if (example && typeof example === 'object') {
            const exampleObj = example as Record<string, unknown>;
            if (!exampleObj.before || !exampleObj.after) {
              warnings.push(`examples[${exampleIndex}]にbeforeまたはafterが不足しています`);
            }
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * YamlRuleをRuleオブジェクトにコンパイル
   */
  static compileRule(yamlRule: YamlRule): RuleCompilationResult {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // 正規表現パターンのコンパイル
      let compiledPattern: RegExp | string;
      try {
        // パターンが正規表現の場合
        if (yamlRule.pattern.startsWith('/')) {
          const lastSlashIndex = yamlRule.pattern.lastIndexOf('/');
          if (lastSlashIndex > 0) {
            const patternBody = yamlRule.pattern.slice(1, lastSlashIndex);
            const flagsPart = yamlRule.pattern.slice(lastSlashIndex + 1);

            // フラグの検証
            const validFlags = /^[gimsuy]*$/;
            if (!validFlags.test(flagsPart)) {
              errors.push(`無効な正規表現フラグです。使用可能なフラグ: g, i, m, s, u, y (指定されたフラグ: ${flagsPart})`);
              return { success: false, errors, warnings };
            }

            compiledPattern = new RegExp(patternBody, flagsPart || 'g');
          } else {
            // 単一のスラッシュのみの場合
            compiledPattern = new RegExp(yamlRule.pattern.slice(1), 'g');
          }
        } else {
          compiledPattern = yamlRule.pattern;
        }
      } catch (error) {
        errors.push(`正規表現パターンのコンパイルに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
        return { success: false, errors, warnings };
      }

      const rule: Rule = {
        id: yamlRule.id,
        severity: yamlRule.severity,
        category: yamlRule.category,
        pattern: compiledPattern,
        message: yamlRule.message,
        autoFix: yamlRule.autoFix ?? false,
        replacement: yamlRule.replacement,
        examples: yamlRule.examples,
        enabled: yamlRule.enabled ?? true
      };

      return {
        success: true,
        rule,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        errors: [`ルールコンパイルエラー: ${error instanceof Error ? error.message : '不明なエラー'}`]
      };
    }
  }

  /**
   * YamlRuleFile全体をコンパイル
   */
  static compileRuleFile(yamlRuleFile: YamlRuleFile): RuleCompilationResult[] {
    return yamlRuleFile.rules.map(yamlRule => this.compileRule(yamlRule));
  }
}
