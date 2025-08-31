export interface FindingResult {
  id: string;
  ruleId: string;
  message: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  severity: "error" | "warning" | "info";
  suggest?: string[];
  fix?: {
    range: { start: { line: number; column: number }; end: { line: number; column: number } };
    text: string;
  };
}

export interface LintResult {
  findings: FindingResult[];
  totalIssues: number;
  fixableIssues: number;
}

export interface RuleConfig {
  id: string;
  enabled: boolean;
  level: "error" | "warn" | "info";
  options?: Record<string, unknown>;
}

export interface TextlintRunnerConfig {
  rules: RuleConfig[];
  presets: string[];
  dictionary: string[];
  ignorePatterns: string[];
}

export interface DictionaryEntry {
  term: string;
  variant?: string[];
  preferred: string;
  notes?: string;
}

export interface ProjectConfig {
  rules: RuleConfig[];
  dictionary: DictionaryEntry[];
  ignoreList: {
    rules: string[];
    ranges: Array<{
      start: { line: number; column: number };
      end: { line: number; column: number };
    }>;
    files: string[];
  };
  targetFilePatterns: string[];
}