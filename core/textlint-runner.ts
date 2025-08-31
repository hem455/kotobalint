import { TextLintCore } from "textlint";
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";
import type { 
  FindingResult, 
  LintResult, 
  TextlintRunnerConfig 
} from "./types.js";

const require = createRequire(import.meta.url);

export class TextlintRunner {
  private core: TextLintCore;
  private config: TextlintRunnerConfig;

  constructor(config?: Partial<TextlintRunnerConfig>) {
    this.core = new TextLintCore();
    this.config = {
      rules: [],
      presets: ["textlint-rule-preset-ja-technical-writing"],
      dictionary: [],
      ignorePatterns: [],
      ...config,
    };
  }

  async initialize(): Promise<void> {
    this.setupPlugins();
    await this.loadPresets();
    await this.loadRules();
  }

  private setupPlugins(): void {
    const textPlugin = require("textlint-plugin-text");
    // Register plain text plugin to handle .txt and extension-less inputs
    this.core.setupPlugins({ text: textPlugin }, {});
  }

  private async loadPresets(): Promise<void> {
    const rules: Record<string, unknown> = {};
    const ruleOptions: Record<string, unknown> = {};

    for (const presetName of this.config.presets) {
      try {
        const preset = require(presetName);
        // Handle preset structure correctly
        if (preset.rules) {
          Object.assign(rules, preset.rules);
          Object.assign(ruleOptions, preset.rulesConfig || {});
        } else {
          // Direct rule assignment for compatibility
          rules[presetName] = preset;
          ruleOptions[presetName] = {};
        }
      } catch (error) {
        console.warn(`Failed to load preset: ${presetName}`, error);
      }
    }

    this.core.setupRules(rules, ruleOptions);
  }

  private async loadRules(): Promise<void> {
    // Custom rules loading will be implemented here
    // For now, using preset rules
  }

  async lintText(text: string, filePath?: string): Promise<LintResult> {
    const ext = filePath ? path.extname(filePath) : ".md";
    const result = await this.core.lintText(text, filePath || `sample${ext}`);

    const findings: FindingResult[] = result.messages.map((msg, index) => ({
      id: `finding-${index}`,
      ruleId: msg.ruleId || "unknown",
      message: msg.message,
      range: {
        // Use available line/column for start; avoid fabricating incorrect end
        start: { line: msg.line, column: msg.column },
        end: { line: msg.line, column: msg.column },
      },
      severity: this.mapSeverity(msg.severity),
      suggest: [], // TODO: Implement suggestions
      fix: msg.fix ? {
        // Keep fix text; range offsets are in absolute index terms in TextLint fix
        // We expose only replacement text here for now to avoid inaccurate mapping
        range: { start: { line: msg.line, column: msg.column }, end: { line: msg.line, column: msg.column } },
        text: msg.fix.text,
      } : undefined,
    }));

    return {
      findings,
      totalIssues: findings.length,
      fixableIssues: findings.filter(f => f.fix).length,
    };
  }

  async lintFile(filePath: string): Promise<LintResult> {
    const text = fs.readFileSync(filePath, "utf8");
    return this.lintText(text, filePath);
  }

  applyFixes(text: string, fixes: FindingResult[]): string {
    // Fallback simple strategy: if explicit fixes provided, apply per-line replacement.
    // For higher accuracy and multi-line support, prefer core.fixText (see fixTextAuto).
    const sortedFixes = fixes
      .filter((f) => f.fix)
      .sort((a, b) => {
        if (!a.fix || !b.fix) return 0;
        return (
          b.fix.range.start.line - a.fix.range.start.line ||
          b.fix.range.start.column - a.fix.range.start.column
        );
      });

    const lines = text.split("\n");
    for (const finding of sortedFixes) {
      if (!finding.fix) continue;
      const lineIndex = finding.fix.range.start.line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) continue;
      const line = lines[lineIndex];
      const startCol = Math.max(0, finding.fix.range.start.column - 1);
      const endCol = Math.max(startCol, finding.fix.range.end.column - 1);
      lines[lineIndex] = line.slice(0, startCol) + finding.fix.text + line.slice(endCol);
    }
    return lines.join("\n");
  }

  async fixTextAuto(text: string, filePath?: string): Promise<{ fixedText: string; applied: number }>{
    const ext = filePath ? path.extname(filePath) : ".md";
    const result = await this.core.fixText(text, filePath || `sample${ext}`);
    return { fixedText: result.output, applied: result.applyingMessages?.length ?? 0 };
  }

  async updateConfig(newConfig: Partial<TextlintRunnerConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    // Reinitialize core with updated rules/presets
    this.core = new TextLintCore();
    this.setupPlugins();
    await this.loadPresets();
    await this.loadRules();
  }

  getConfig(): TextlintRunnerConfig {
    return { ...this.config };
  }

  private mapSeverity(severity: number): "error" | "warning" | "info" {
    switch (severity) {
      case 2: return "error";
      case 1: return "warning";
      default: return "info";
    }
  }
}
