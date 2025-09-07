import type {
  Rule,
  Issue,
  TextRange,
  RuleEngineResult,
  RuleEngineConfig,
  RuleExecutionContext,
  IssueSeverity,
  IssueCategory,
  Suggestion
} from '@/types';

/**
 * 基本ルールエンジン
 * コンパイルされたルールを使用してテキストを解析し、問題を検出する
 */
export class RuleEngine {
  private rules: Map<string, Rule> = new Map();
  private defaultConfig: RuleEngineConfig = {
    maxIssues: 100,
    timeout: 5000, // 5秒
    enabledCategories: ['style', 'grammar', 'honorific', 'consistency', 'risk'],
    enabledSeverities: ['info', 'warn', 'error'],
    excludeRules: []
  };

  /**
   * ルールを追加
   */
  addRule(rule: Rule): void {
    if (!rule.enabled) {
      return; // 無効化されたルールはスキップ
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * 複数のルールを追加
   */
  addRules(rules: Rule[]): void {
    rules.forEach(rule => this.addRule(rule));
  }

  /**
   * ルールを削除
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * 全てのルールを削除
   */
  clearRules(): void {
    this.rules.clear();
  }

  /**
   * 登録されているルール数を取得
   */
  getRuleCount(): number {
    return this.rules.size;
  }

  /**
   * テキストを解析して問題を検出
   */
  async analyzeText(text: string, config?: Partial<RuleEngineConfig>): Promise<RuleEngineResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    const context: RuleExecutionContext = {
      text,
      config: mergedConfig,
      startTime,
      processedRules: new Set()
    };

    const issues: Issue[] = [];
    const matchedRules: string[] = [];

    try {
      // 各ルールを実行
      for (const [ruleId, rule] of Array.from(this.rules)) {
        // タイムアウトチェック
        if (Date.now() - startTime > (mergedConfig.timeout || 5000)) {
          console.warn(`ルールエンジンのタイムアウト: ${mergedConfig.timeout}ms`);
          break;
        }

        // 除外ルールのチェック
        if (mergedConfig.excludeRules?.includes(ruleId)) {
          continue;
        }

        // カテゴリフィルタのチェック
        if (mergedConfig.enabledCategories && !mergedConfig.enabledCategories.includes(rule.category)) {
          continue;
        }

        // 重要度フィルタのチェック
        if (mergedConfig.enabledSeverities && !mergedConfig.enabledSeverities.includes(rule.severity)) {
          continue;
        }

        // ルール実行
        const ruleIssues = await this.executeRule(rule, context);

        if (ruleIssues.length > 0) {
          issues.push(...ruleIssues);
          matchedRules.push(ruleId);

          // 最大問題数チェック
          if (mergedConfig.maxIssues && issues.length >= mergedConfig.maxIssues) {
            break;
          }
        }

        context.processedRules.add(ruleId);
      }

      // 問題を位置でソート
      issues.sort((a, b) => a.range.start - b.range.start);

    } catch (error) {
      console.error('ルールエンジン実行エラー:', error);
    }

    const processingTime = Date.now() - startTime;

    return {
      issues,
      matchedRules,
      processingTime,
      textLength: text.length
    };
  }

  /**
   * 個別のルールを実行
   */
  private async executeRule(rule: Rule, context: RuleExecutionContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const { text } = context;

    try {
      if (typeof rule.pattern === 'string') {
        // 文字列パターンマッチング
        const matches = this.findStringMatches(text, rule.pattern);

        for (const match of matches) {
          const issue = this.createIssueFromMatch(rule, match, text);
          if (issue) {
            issues.push(issue);
          }
        }

      } else if (rule.pattern instanceof RegExp) {
        // 正規表現パターンマッチング
        const matches = this.findRegexMatches(text, rule.pattern);

        for (const match of matches) {
          const issue = this.createIssueFromRegexMatch(rule, match, text);
          if (issue) {
            issues.push(issue);
          }
        }
      }

    } catch (error) {
      console.warn(`ルール ${rule.id} の実行エラー:`, error);
    }

    return issues;
  }

  /**
   * 文字列パターンマッチング
   */
  private findStringMatches(text: string, pattern: string): TextRange[] {
    const matches: TextRange[] = [];
    let index = text.indexOf(pattern);

    while (index !== -1) {
      matches.push({
        start: index,
        end: index + pattern.length
      });
      index = text.indexOf(pattern, index + 1);
    }

    return matches;
  }

  /**
   * 正規表現パターンマッチング
   */
  private findRegexMatches(text: string, pattern: RegExp): RegExpExecArray[] {
    const matches: RegExpExecArray[] = [];
    // 元のフラグに 'g' が含まれていない場合は追加
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const regex = new RegExp(pattern.source, flags); // 新しいインスタンスを作成
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match);

      // ゼロ幅マッチの場合は次の文字へ進める
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * 文字列マッチからIssueを作成
   */
  private createIssueFromMatch(rule: Rule, range: TextRange, text: string): Issue | null {
    const matchedText = text.slice(range.start, range.end);

    const suggestions: Suggestion[] = [];
    if (rule.autoFix && rule.replacement) {
      suggestions.push({
        text: rule.replacement,
        rationale: '自動修正を適用します'
      });
    }

    return {
      id: `${rule.id}_${range.start}_${range.end}`,
      source: 'rule',
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      range,
      suggestions,
      ruleVersion: rule.id
    };
  }

  /**
   * 正規表現マッチからIssueを作成
   */
  private createIssueFromRegexMatch(rule: Rule, match: RegExpExecArray, text: string): Issue | null {
    const range: TextRange = {
      start: match.index,
      end: match.index + match[0].length
    };

    const suggestions: Suggestion[] = [];
    if (rule.autoFix && rule.replacement) {
      let replacement = rule.replacement;

      // キャプチャグループの置換（マルチ-digit対応）
      replacement = replacement.replace(/\$(\d+)/g, (_, n) => match[Number(n)] || '');

      suggestions.push({
        text: replacement,
        rationale: '自動修正を適用します'
      });
    }

    return {
      id: `${rule.id}_${range.start}_${range.end}`,
      source: 'rule',
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      range,
      suggestions,
      ruleVersion: rule.id
    };
  }

  /**
   * 設定を取得
   */
  getConfig(): RuleEngineConfig {
    return { ...this.defaultConfig };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<RuleEngineConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * 登録されているルールの一覧を取得
   */
  getRegisteredRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 指定したカテゴリのルールを取得
   */
  getRulesByCategory(category: IssueCategory): Rule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  /**
   * 指定した重要度のルールを取得
   */
  getRulesBySeverity(severity: IssueSeverity): Rule[] {
    return Array.from(this.rules.values()).filter(rule => rule.severity === severity);
  }
}
