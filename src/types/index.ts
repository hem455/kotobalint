// Core Data Models

export interface Issue {
  id: string;
  source: 'rule' | 'llm';
  severity: 'info' | 'warn' | 'error';
  category: 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk';
  message: string;
  range: { start: number; end: number };
  suggestions: Suggestion[];
  ruleVersion?: string;
}

export interface Suggestion {
  text: string;
  rationale?: string;
  confidence?: number;
}

export interface Rule {
  id: string;
  severity: 'info' | 'warn' | 'error';
  category: string;
  pattern?: string;
  message: string;
  autoFix: boolean;
  replacement?: string;
}

// API Interfaces

export interface LintRequest {
  text: string;
  ruleset?: string;
  options?: {
    maxIssues?: number;
  };
}

export interface LintResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
    textLength: number;
    rulesetId: string;
  };
}

export interface SuggestRequest {
  passages: Array<{
    text: string;
    range: { start: number; end: number };
  }>;
  style: 'blog' | 'business' | 'academic';
}

export interface SuggestResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
  };
}

// Settings Data Model

export interface AppSettings {
  analysis: {
    trigger: 'manual' | 'auto';
    autoDelay: number; // milliseconds
    maxSentenceLength: number;
  };
  rules: {
    activeRuleset: string;
    disabledRules: string[];
    severityOverrides: Record<string, 'info' | 'warn' | 'error'>;
  };
  llm: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    timeout: number;
    maxSuggestions: number;
  };
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

// Utility Types

export type IssueSeverity = 'info' | 'warn' | 'error';
export type IssueSource = 'rule' | 'llm';
export type IssueCategory = 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk';
export type AnalysisTrigger = 'manual' | 'auto';
export type Theme = 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';
export type FontFamily = 'monospace' | 'sans-serif';




