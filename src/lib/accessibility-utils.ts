/**
 * アクセシビリティユーティリティ
 * 要件10.2に対応
 */

import { IssueSeverity, IssueCategory } from '@/types';

/**
 * 重要度レベルのアクセシブルな表示情報
 */
export interface AccessibilitySeverityInfo {
  label: string;
  icon: string;
  colorClass: string;
  ariaLabel: string;
}

/**
 * 重要度レベルのアクセシビリティ情報を取得
 */
export function getSeverityAccessibilityInfo(severity: IssueSeverity): AccessibilitySeverityInfo {
  const severityMap: Record<IssueSeverity, AccessibilitySeverityInfo> = {
    error: {
      label: 'エラー',
      icon: '⚠️',
      colorClass: 'bg-red-100 text-red-800',
      ariaLabel: 'エラー: 修正が必要な問題'
    },
    warn: {
      label: '警告',
      icon: '⚠️',
      colorClass: 'bg-yellow-100 text-yellow-800',
      ariaLabel: '警告: 改善を推奨する問題'
    },
    info: {
      label: '情報',
      icon: 'ℹ️',
      colorClass: 'bg-blue-100 text-blue-800',
      ariaLabel: '情報: 参考となる提案'
    }
  };

  return severityMap[severity];
}

/**
 * カテゴリのアクセシブルな表示情報
 */
export interface AccessibilityCategoryInfo {
  label: string;
  description: string;
  ariaLabel: string;
}

/**
 * カテゴリのアクセシビリティ情報を取得
 */
export function getCategoryAccessibilityInfo(category: IssueCategory): AccessibilityCategoryInfo {
  const categoryMap: Record<IssueCategory, AccessibilityCategoryInfo> = {
    style: {
      label: 'スタイル',
      description: '文章のスタイルに関する問題',
      ariaLabel: 'スタイル: 文章のスタイルに関する問題'
    },
    grammar: {
      label: '文法',
      description: '文法的な問題',
      ariaLabel: '文法: 文法的な問題'
    },
    honorific: {
      label: '敬語',
      description: '敬語の使い方に関する問題',
      ariaLabel: '敬語: 敬語の使い方に関する問題'
    },
    consistency: {
      label: '一貫性',
      description: '表記の一貫性に関する問題',
      ariaLabel: '一貫性: 表記の一貫性に関する問題'
    },
    risk: {
      label: 'リスク',
      description: 'リスクのある表現',
      ariaLabel: 'リスク: リスクのある表現'
    }
  };

  return categoryMap[category];
}

/**
 * 問題のアクセシブルな説明文を生成
 */
export function generateIssueDescription(issue: {
  message: string;
  severity: IssueSeverity;
  category: IssueCategory;
  source: 'rule' | 'llm';
  range: { start: number; end: number };
  suggestions?: Array<{ text: string; rationale?: string }>;
}): string {
  const severityInfo = getSeverityAccessibilityInfo(issue.severity);
  const categoryInfo = getCategoryAccessibilityInfo(issue.category);
  const sourceText = issue.source === 'rule' ? 'ルールエンジン' : 'AI提案';
  const suggestionCount = issue.suggestions?.length || 0;
  
  let description = `${severityInfo.label}: ${issue.message}`;
  description += ` カテゴリ: ${categoryInfo.label}`;
  description += ` ソース: ${sourceText}`;
  description += ` 位置: ${issue.range.start}文字目から${issue.range.end}文字目`;
  
  if (suggestionCount > 0) {
    description += ` 修正案: ${suggestionCount}件の提案があります`;
  }
  
  return description;
}

/**
 * 問題リストのアクセシブルな説明文を生成
 */
export function generateIssueListDescription(issues: Array<{
  severity: IssueSeverity;
  category: IssueCategory;
  source: 'rule' | 'llm';
}>, filters?: {
  source?: string[];
  severity?: IssueSeverity[];
  category?: IssueCategory[];
}): string {
  const totalCount = issues.length;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warn').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  let description = `問題リスト: 合計${totalCount}件の問題があります`;
  description += ` エラー: ${errorCount}件`;
  description += ` 警告: ${warnCount}件`;
  description += ` 情報: ${infoCount}件`;
  
  if (filters) {
    if (filters.source && filters.source.length > 0) {
      const sourceText = filters.source.includes('rule') ? 'ルール' : 'AI';
      description += ` フィルター: ${sourceText}のみ表示`;
    }
    if (filters.severity && filters.severity.length > 0) {
      const severityText = filters.severity.map(s => getSeverityAccessibilityInfo(s).label).join('、');
      description += ` 重要度フィルター: ${severityText}`;
    }
    if (filters.category && filters.category.length > 0) {
      const categoryText = filters.category.map(c => getCategoryAccessibilityInfo(c).label).join('、');
      description += ` カテゴリフィルター: ${categoryText}`;
    }
  }
  
  return description;
}

/**
 * フォーカス管理のためのARIA属性を生成
 */
export function generateFocusAttributes(
  isActive: boolean,
  isSelected: boolean,
  role: string = 'button'
): Record<string, string> {
  return {
    role,
    tabIndex: isActive ? '0' : '-1',
    'aria-selected': isSelected ? 'true' : 'false',
    'aria-current': isSelected ? 'true' : 'false'
  };
}

/**
 * アニメーションのアクセシビリティ設定
 */
export function getAccessibleAnimationClasses(): string {
  // ユーザーがアニメーションを無効にしている場合の対応
  return 'transition-all duration-150 ease-in-out motion-reduce:transition-none';
}

/**
 * スクリーンリーダー用の隠しテキストを生成
 */
export function createScreenReaderText(text: string): string {
  return `<span class="sr-only" aria-hidden="false">${text}</span>`;
}

/**
 * フォーカスインジケーターのクラス
 */
export function getFocusIndicatorClasses(): string {
  return 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white';
}

/**
 * 高コントラストモード対応のクラス
 */
export function getHighContrastClasses(): string {
  return 'border-2 border-transparent hover:border-gray-300 focus:border-blue-500';
}
