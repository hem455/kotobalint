// Core Data Models
import type { LlmSettings } from './llm';
export interface Issue {
  id: string;
  source: IssueSource;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  range: TextRange;
  suggestions: Suggestion[];
  ruleVersion?: string;
  metadata?: Record<string, any>;
}

export interface Suggestion {
  text: string;
  rationale?: string;
  confidence?: number;
  isPreferred?: boolean;
}

export interface Rule {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  pattern?: RegExp | string;
  message: string;
  autoFix: boolean;
  replacement?: string;
  examples?: Array<{
    before: string;
    after: string;
  }>;
  enabled: boolean;
}

// Text and Range Types
export interface TextRange {
  start: number;
  end: number;
}

export interface TextPassage {
  text: string;
  range: TextRange;
}

// API Interfaces
export interface LintRequest {
  text: string;
  ruleset?: string;
  options?: {
    maxIssues?: number;
    includeSuggestions?: boolean;
    timeout?: number;
  };
}

export interface LintResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
    textLength: number;
    rulesetId: string;
    processingStats?: {
      rulesProcessed: number;
      suggestionsGenerated: number;
    };
  };
}

export interface SuggestRequest {
  passages: TextPassage[];
  style: ContentStyle;
  context?: {
    beforeText?: string;
    afterText?: string;
  };
}

export interface SuggestResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
    model?: string;
    tokensUsed?: number;
  };
}

export interface AnalyzeRequest {
  text: string;
  preset: Preset;
}

export interface AnalyzeResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
    preset: Preset;
    rulesApplied: number;
    textLength: number;
  };
}

// Settings Data Model

export interface AppSettings {
  analysis: {
    trigger: 'manual' | 'auto';
    autoDelay: number; // milliseconds
    maxSentenceLength: number;
    mode: AnalysisMode;
    preset: Preset;
  };
  rules: {
    activeRuleset: string;
    disabledRules: string[];
    severityOverrides: Record<string, 'info' | 'warn' | 'error'>;
  };
  llm: LlmSettings;
  ui: {
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
    showLineNumbers: boolean;
    fontFamily: 'monospace' | 'sans-serif';
  };
  privacy: {
    allowExternalRequests: boolean;
    logAnalytics: boolean;
  };
}

// Component Props Interfaces

export interface IssueFilters {
  source?: ('rule' | 'llm')[];
  severity?: ('info' | 'warn' | 'error')[];
  category?: string[];
}

export interface IssueStats {
  total: number;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

// Error Handling

export interface AppError {
  code: string;
  message: string;
  details?: any;
}

// Content and Style Types
export type ContentStyle = 'blog' | 'business' | 'academic' | 'technical' | 'casual';
export type DocumentType = 'article' | 'email' | 'report' | 'presentation' | 'webpage';

// Utility Types
export type IssueSeverity = 'info' | 'warn' | 'error';
export type IssueSource = 'rule' | 'llm';
export type IssueCategory = 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk';
export type AnalysisTrigger = 'manual' | 'auto';
export type AnalysisMode = 'llm' | 'rules';
export type Preset = 'light' | 'standard' | 'strict';
export type Theme = 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';
export type FontFamily = 'monospace' | 'sans-serif';

// Generic Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// API Response Types
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: AppError;
};

// Event Types for UI Interactions
export interface TextSelectionEvent {
  text: string;
  range: TextRange;
  source: 'user' | 'programmatic';
}

export interface IssueActionEvent {
  issueId: string;
  action: 'apply' | 'dismiss' | 'edit';
  suggestionIndex?: number;
}

// YAML Rule File Types
export interface YamlRuleFile {
  meta: {
    id: string;
    version: string;
    locale: string;
    createdAt: string;
    updatedAt: string;
    author: string;
    description?: string;
  };
  rules: YamlRule[];
}

export interface YamlRule {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  pattern: string;
  message: string;
  autoFix?: boolean;
  replacement?: string;
  examples?: Array<{
    before: string;
    after: string;
  }>;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

// Rule Engine Types
export interface RuleMatch {
  ruleId: string;
  range: TextRange;
  matchedText: string;
  captures?: string[];
}

export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Parser Types
export interface YamlParseResult {
  success: boolean;
  data?: YamlRuleFile;
  errors?: string[];
  warnings?: string[];
}

export interface RuleCompilationResult {
  success: boolean;
  rule?: Rule;
  errors?: string[];
  warnings?: string[];
}

// Rule Engine Types
export interface RuleEngineResult {
  issues: Issue[];
  matchedRules: string[];
  processingTime: number;
  textLength: number;
}

export interface RuleEngineConfig {
  maxIssues?: number;
  timeout?: number;
  enabledCategories?: IssueCategory[];
  enabledSeverities?: IssueSeverity[];
  excludeRules?: string[];
}

export interface RuleExecutionContext {
  text: string;
  config: RuleEngineConfig;
  startTime: number;
  processedRules: Set<string>;
}




