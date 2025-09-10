/**
 * プロンプトインジェクション防御機能
 * ユーザー提供スニペットをサニタイズし、許可リスト方式でLLMへ渡す要素を限定
 */

export interface SanitizedPrompt {
  originalText: string;
  sanitizedText: string;
  maskedText: string;
  systemPrefix: string;
  userContent: string;
  warnings: string[];
}

/**
 * プロンプトサニタイザークラス
 */
export class PromptSanitizer {
  private readonly SYSTEM_PREFIX = 'SYSTEM_PROMPT_START';
  private readonly SYSTEM_SUFFIX = 'SYSTEM_PROMPT_END';
  private readonly USER_PREFIX = 'USER_CONTENT_START';
  private readonly USER_SUFFIX = 'USER_CONTENT_END';

  // 危険なパターン（プロンプトインジェクション攻撃）
  private readonly DANGEROUS_PATTERNS = [
    // 英語パターン
    /(?:ignore|forget|disregard|override).*(?:previous|system|instructions?|prompt)/gi,
    /(?:you are|act as|pretend to be|roleplay as)/gi,
    /(?:new task|new instruction|override instruction)/gi,
    /(?:end|stop|finish).*(?:prompt|instruction|task)/gi,
    /```(?:end|stop|finish)```/gi,
    /(?:output|respond|answer).*(?:in|as|with).*(?:json|xml|yaml|markdown)/gi,
    /(?:format|structure).*(?:response|output|answer)/gi,
    /(?:ignore|bypass|circumvent).*(?:safety|filter|restriction)/gi,
    /(?:pretend|simulate|imagine).*(?:you are|this is)/gi,
    /(?:do not|don't|never).*(?:follow|obey|listen to)/gi,
    /(?:instead|rather|instead of).*(?:do|perform|execute)/gi,
    
    // 日本語パターン
    /(?:無視|忘れる|無視する|上書き).*(?:前|システム|指示|プロンプト)/gi,
    /(?:あなたは|として|ふりをして|ロールプレイ)/gi,
    /(?:新しい|新たな).*(?:タスク|指示|命令)/gi,
    /(?:終了|停止|終わる).*(?:プロンプト|指示|タスク)/gi,
    /(?:出力|応答|回答).*(?:として|で|形式).*(?:json|xml|yaml|markdown)/gi,
    /(?:形式|構造).*(?:レスポンス|出力|回答)/gi,
    /(?:無視|回避|迂回).*(?:安全|フィルター|制限)/gi,
    /(?:ふり|シミュレート|想像).*(?:あなたは|これは)/gi,
    /(?:しない|しないで|決して).*(?:従う|従わない|聞く)/gi,
    /(?:代わりに|むしろ|ではなく).*(?:する|実行|行う)/gi,
    
    // システム指示の上書き試行（日本語）
    /(?:システム|指示|命令).*(?:変更|上書き|無視)/gi,
    /(?:プロンプト|指示).*(?:終了|停止|無効)/gi,
    
    // 出力形式の変更試行（日本語）
    /(?:JSON|XML|YAML|Markdown).*(?:形式|で出力|で返答)/gi,
    /(?:形式|フォーマット).*(?:変更|変更する)/gi,
    
    // 制限の回避試行（日本語）
    /(?:安全|フィルター|制限).*(?:無視|回避|迂回)/gi,
    /(?:ルール|規則).*(?:無視|破る|回避)/gi
  ];

  // 許可された文字（日本語、英数字、基本的な記号）
  private readonly ALLOWED_CHARS = /[ぁ-んァ-ヶ一-龯a-zA-Z0-9\s。、！？「」『』（）［］｛｝：；"'',.?!\-_=+*&%$#@~`|\\/<>]/g;

  /**
   * プロンプトをサニタイズ
   */
  sanitizePrompt(originalText: string, systemInstructions: string): SanitizedPrompt {
    const warnings: string[] = [];
    
    // 1. 危険なパターンを検出
    const detectedThreats = this.detectThreats(originalText);
    if (detectedThreats.length > 0) {
      warnings.push(`プロンプトインジェクションの可能性を検出: ${detectedThreats.join(', ')}`);
    }

    // 2. テキストをサニタイズ
    const sanitizedText = this.sanitizeText(originalText);
    
    // 3. システム指示とユーザーコンテンツを分離
    const systemPrefix = this.buildSystemPrefix(systemInstructions);
    const userContent = this.buildUserContent(sanitizedText);

    // 4. 最終的なプロンプトを構築
    const finalPrompt = `${systemPrefix}\n\n${userContent}`;

    return {
      originalText,
      sanitizedText,
      maskedText: this.maskForLogging(sanitizedText),
      systemPrefix,
      userContent,
      warnings
    };
  }

  /**
   * 危険なパターンを検出
   */
  private detectThreats(text: string): string[] {
    const threats: string[] = [];
    
    for (const pattern of this.DANGEROUS_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        threats.push(...matches);
      }
    }
    
    return threats;
  }

  /**
   * テキストをサニタイズ
   */
  private sanitizeText(text: string): string {
    // 1. 危険なパターンを除去
    let sanitized = text;
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }

    // 2. 許可された文字のみを保持
    const allowedMatches = sanitized.match(this.ALLOWED_CHARS);
    if (allowedMatches) {
      sanitized = allowedMatches.join('');
    } else {
      sanitized = '';
    }

    // 3. 連続する空白を単一の空白に
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // 4. 長すぎる場合は切り詰め（最大1000文字）
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000) + '...';
    }

    return sanitized;
  }

  /**
   * システム指示プレフィックスを構築
   */
  private buildSystemPrefix(instructions: string): string {
    return `${this.SYSTEM_PREFIX}\n${instructions}\n${this.SYSTEM_SUFFIX}`;
  }

  /**
   * ユーザーコンテンツを構築
   */
  private buildUserContent(text: string): string {
    return `${this.USER_PREFIX}\n${text}\n${this.USER_SUFFIX}`;
  }

  /**
   * プロンプトが安全かチェック
   */
  isSafe(text: string): boolean {
    const threats = this.detectThreats(text);
    return threats.length === 0;
  }

  /**
   * ログ用にプロンプトをマスク
   */
  maskForLogging(text: string): string {
    // 危険なパターンをマスク
    let masked = text;
    for (const pattern of this.DANGEROUS_PATTERNS) {
      masked = masked.replace(pattern, '[FILTERED]');
    }
    return masked;
  }
}

/**
 * シングルトンインスタンス
 */
export const promptSanitizer = new PromptSanitizer();
