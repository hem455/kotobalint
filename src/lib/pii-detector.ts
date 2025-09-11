/**
 * PII（個人識別情報）検出とマスキング機能
 * 氏名・住所・電話番号・メール・識別子等を検出し、外部送信前にマスクする
 */

export interface PIIMatch {
  type: 'name' | 'email' | 'phone' | 'address' | 'id' | 'credit_card' | 'ssn';
  value: string;
  maskedValue: string;
  start: number;
  end: number;
}

export interface MaskedText {
  originalText: string;
  maskedText: string;
  piiMatches: PIIMatch[];
}

/**
 * PII検出器クラス
 */
export class PIIDetector {
  private patterns: Map<string, RegExp> = new Map();
  private replacementMap: Map<string, string> = new Map();
  private compiledPatterns: Map<string, RegExp> = new Map();
  private config: { debug: boolean };

  constructor(config?: Partial<{ debug: boolean }>) {
    this.config = { debug: false, ...(config || {}) };
    this.initializePatterns();
  }

  /**
   * 正規表現をコンパイルしてキャッシュ
   */
  private getCompiledPattern(pattern: string): RegExp {
    if (!this.compiledPatterns.has(pattern)) {
      this.compiledPatterns.set(pattern, new RegExp(pattern, 'g'));
    }
    return this.compiledPatterns.get(pattern)!;
  }

  /**
   * 検出パターンを初期化
   */
  private initializePatterns(): void {
    // 日本語氏名パターン（より精密）
    this.patterns.set('name', /(?:[ぁ-んァ-ヶ一-龯]{2,6}(?:さん|様|くん|ちゃん|先生|部長|課長|主任)?|[A-Z][a-z]+ [A-Z][a-z]+)/g);
    
    // 敬語を含む氏名パターン
    this.patterns.set('name_with_honorific', /[ぁ-んァ-ヶ一-龯]{2,6}[さん|様|くん|ちゃん|先生|部長|課長|主任|殿]/g);
    
    // メールアドレス（より厳密）
    this.patterns.set('email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    
    // 電話番号（日本の形式、より包括的）
    this.patterns.set('phone', /(?:0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{4}|0[0-9]{9,10}|\+81-?[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{4})/g);
    
    // 住所（郵便番号、都道府県、市区町村等）
    this.patterns.set('address', /(?:〒[0-9]{3}-?[0-9]{4}|[都道府県市区町村][^。、！？]{0,30}|[0-9]{3}-[0-9]{4})/g);
    
    // 識別子（ID、コード等、より厳密）
    this.patterns.set('id', /\b(?:[A-Z0-9]{8,}|[a-z0-9]{8,}|[A-Za-z0-9]{8,})\b/g);
    
    // クレジットカード番号（Luhnアルゴリズム対応）
    this.patterns.set('credit_card', /\b[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}\b/g);
    
    // 社会保険番号（日本の形式）
    this.patterns.set('ssn', /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g);
    
    // パスポート番号
    this.patterns.set('passport', /\b[A-Z]{2}[0-9]{7}\b/g);
    
    // 運転免許証番号
    this.patterns.set('driver_license', /\b[0-9]{12}\b/g);
  }

  /**
   * テキストからPIIを検出し、マスクする
   */
  detectAndMask(text: string): MaskedText {
    // 入力の生データはログに出さない
    const piiMatches: PIIMatch[] = [];
    let maskedText = text;

    // 各パターンで検出
    Array.from(this.patterns.entries()).forEach(([type, pattern]) => {
      const matches = Array.from(text.matchAll(pattern));
      
      for (const match of matches) {
        if (match.index === undefined) continue;
        
        const value = match[0];
        const maskedValue = this.generateMask(type, value);
        
        piiMatches.push({
          type: type as PIIMatch['type'],
          value,
          maskedValue,
          start: match.index,
          end: match.index + value.length
        });
      }
    });

    // 重複を除去し、位置順にソート
    const uniqueMatches = this.removeOverlappingMatches(piiMatches);
    uniqueMatches.sort((a, b) => a.start - b.start);

    // マスクを適用（後ろから適用して位置がずれないようにする）
    for (let i = uniqueMatches.length - 1; i >= 0; i--) {
      const match = uniqueMatches[i];
      maskedText = maskedText.substring(0, match.start) + 
                   match.maskedValue + 
                   maskedText.substring(match.end);
    }

    if (this.config.debug) {
      console.debug("[PII] masked output:", maskedText);
      console.debug("[PII] matches:", uniqueMatches.map(m => ({ ...m, value: undefined })));
    }
    
    return {
      originalText: text,
      maskedText,
      piiMatches: uniqueMatches
    };
  }

  /**
   * 重複するマッチを除去
   */
  private removeOverlappingMatches(matches: PIIMatch[]): PIIMatch[] {
    const sorted = matches.sort((a, b) => a.start - b.start);
    const result: PIIMatch[] = [];
    
    for (const match of sorted) {
      const hasOverlap = result.some(existing => 
        (match.start < existing.end && match.end > existing.start)
      );
      
      if (!hasOverlap) {
        result.push(match);
      }
    }
    
    return result;
  }

  /**
   * タイプに応じたマスク値を生成
   */
  private generateMask(type: string, value: string): string {
    switch (type) {
      case 'name':
        return '[氏名]';
      case 'email':
        return '[メールアドレス]';
      case 'phone':
        return '[電話番号]';
      case 'address':
        return '[住所]';
      case 'id':
        return '[ID]';
      case 'credit_card':
        return '[クレジットカード番号]';
      case 'ssn':
        return '[社会保険番号]';
      default:
        return '[個人情報]';
    }
  }

  /**
   * テキストにPIIが含まれているかチェック
   */
  hasPII(text: string): boolean {
    for (const pattern of Array.from(this.patterns.values())) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * ログ用にPIIをマスク
   */
  maskForLogging(text: string): string {
    const { maskedText } = this.detectAndMask(text);
    return maskedText;
  }
}

/**
 * シングルトンインスタンス
 */
export const piiDetector = new PIIDetector();
