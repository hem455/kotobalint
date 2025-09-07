import type { SuggestRequest, SuggestResponse, TextPassage, Issue, Suggestion, ContentStyle } from '@/types';

  /**
   * Gemini APIクライアント
   * ローカルGemini 2.0 Flash API (gemini-2.0-flash-exp) との通信を管理
   */
export class GeminiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private maxSuggestions: number;

  constructor(config: {
    baseUrl: string;
    apiKey: string;
    timeout?: number;
    maxSuggestions?: number;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 末尾のスラッシュを削除
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.maxSuggestions = config.maxSuggestions || 3;
  }

  /**
   * テキストの校正提案を生成
   */
  async generateSuggestions(request: SuggestRequest): Promise<{
    success: boolean;
    issues?: Issue[];
    error?: string;
    elapsedMs?: number;
  }> {
    const startTime = Date.now();
    
    try {
      // リクエストの検証
      if (!request.passages || request.passages.length === 0) {
        return {
          success: false,
          error: 'テキスト抜粋が指定されていません'
        };
      }

      // プロンプトの生成
      const prompt = this.buildPrompt(request);
      
      // Gemini APIへのリクエスト
      const response = await this.callGeminiAPI(prompt);
      
      if (!response.success) {
        return {
          success: false,
          error: response.error,
          elapsedMs: Date.now() - startTime
        };
      }

      // レスポンスの解析
      const { text, positionMapping } = this.concatenatePassages(request.passages);
      const issues = this.parseResponse(response.content!, request.passages, positionMapping);
      
      return {
        success: true,
        issues,
        elapsedMs: Date.now() - startTime
      };

    } catch (error) {
      console.error('Gemini API エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました',
        elapsedMs: Date.now() - startTime
      };
    }
  }

  /**
   * プロンプトを構築
   */
  private buildPrompt(request: SuggestRequest): string {
    const { passages, style, context } = request;
    
    // テキスト抜粋を結合（位置マッピングを保持）
    const { text, positionMapping } = this.concatenatePassages(passages);
    
    // コンテキスト情報
    const contextInfo = context ? 
      `前後の文脈:\n前: ${context.beforeText || 'なし'}\n後: ${context.afterText || 'なし'}\n` : '';

    // スタイルに応じた指示
    const styleInstructions = this.getStyleInstructions(style);

    return `あなたは日本語の校正専門家です。以下のテキストを校正し、改善提案を行ってください。

${contextInfo}テキスト:
${text}

${styleInstructions}

以下の形式でJSONレスポンスを返してください:
{
  "issues": [
    {
      "id": "unique_id",
      "severity": "info|warn|error",
      "category": "style|grammar|honorific|consistency|risk",
      "message": "問題の説明",
      "range": {"start": 0, "end": 10},
      "suggestions": [
        {
          "text": "修正案",
          "rationale": "修正理由",
          "confidence": 0.8
        }
      ]
    }
  ]
}

注意事項:
- 断定的でない表現を使用してください（「〜かもしれません」「〜を検討してください」など）
- 最大${this.maxSuggestions}個の提案まで生成してください
- 各提案には信頼度（confidence）を含めてください
- 問題の範囲（range）は元のテキスト内の文字位置で指定してください
- 重要度は適切に設定してください（info: 軽微、warn: 注意、error: 重要）`;
  }

  /**
   * テキスト抜粋を結合し、位置マッピングを生成
   */
  private concatenatePassages(passages: TextPassage[]): {
    text: string;
    positionMapping: { passageIndex: number; startOffset: number }[];
  } {
    const positionMapping: { passageIndex: number; startOffset: number }[] = [];
    const parts: string[] = [];
    const separator = '\n---PASSAGE_SEPARATOR---\n';
    
    let currentOffset = 0;
    
    for (let i = 0; i < passages.length; i++) {
      const passage = passages[i];
      
      // 位置マッピングを記録
      positionMapping.push({
        passageIndex: i,
        startOffset: currentOffset
      });
      
      // パッセージIDを付けてテキストを追加
      parts.push(`[Passage ${i + 1}] ${passage.text}`);
      
      // 次のパッセージとの間にセパレータを追加（最後のパッセージ以外）
      if (i < passages.length - 1) {
        parts.push(separator);
        currentOffset += passage.text.length + separator.length;
      } else {
        currentOffset += passage.text.length;
      }
    }
    
    return {
      text: parts.join(''),
      positionMapping
    };
  }

  /**
   * スタイルに応じた指示を取得
   */
  private getStyleInstructions(style: ContentStyle): string {
    const instructions = {
      blog: 'ブログ記事として読みやすく、親しみやすい文体で校正してください。',
      business: 'ビジネス文書として適切で、丁寧で正確な表現を心がけてください。',
      academic: '学術論文として適切で、客観的で正確な表現を心がけてください。',
      technical: '技術文書として適切で、専門用語の使用と正確性を重視してください。',
      casual: 'カジュアルな文体で、自然で親しみやすい表現を心がけてください。'
    };

    return instructions[style] || instructions.business;
  }

  /**
   * Gemini APIを呼び出し
   */
  private async callGeminiAPI(prompt: string): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1beta/models/gemini-2.0-flash-exp:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API エラー (${response.status}): ${errorText}`
        };
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        return {
          success: false,
          error: 'API から有効なレスポンスが返されませんでした'
        };
      }

      const content = data.candidates[0].content?.parts?.[0]?.text;
      if (!content) {
        return {
          success: false,
          error: 'API レスポンスにテキストが含まれていません'
        };
      }

      return {
        success: true,
        content
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: `リクエストがタイムアウトしました (${this.timeout}ms)`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'API 呼び出しエラー'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * APIレスポンスを解析してIssue配列に変換
   */
  private parseResponse(content: string, passages: TextPassage[], positionMapping: { passageIndex: number; startOffset: number }[]): Issue[] {
    try {
      // JSON部分を抽出（改善されたロジック）
      let jsonString = content;
      
      // まず ```json コードブロックを探す
      const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1];
      } else {
        // コードブロックが見つからない場合、最初の '{' と最後の '}' を探す
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = content.substring(firstBrace, lastBrace + 1);
        }
      }
      
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        console.warn('API レスポンスに issues 配列がありません');
        return [];
      }

      const issues: Issue[] = [];
      
      for (const issueData of parsed.issues) {
        try {
          const issue = this.convertToIssue(issueData, passages, positionMapping);
          if (issue) {
            issues.push(issue);
          }
        } catch (error) {
          console.warn('Issue の変換エラー:', error, issueData);
        }
      }

      return issues;

    } catch (error) {
      console.error('API レスポンスの解析エラー:', error);
      console.error('レスポンス内容:', content);
      return [];
    }
  }

  /**
   * APIレスポンスのIssueデータをIssueオブジェクトに変換
   */
  private convertToIssue(issueData: any, passages: TextPassage[], positionMapping: { passageIndex: number; startOffset: number }[]): Issue | null {
    try {
      // 必須フィールドの検証
      if (!issueData.id || !issueData.message || !issueData.range) {
        return null;
      }

      // 範囲の検証と調整
      const range = this.adjustRange(issueData.range, passages, positionMapping);
      if (!range) {
        return null;
      }

      // 提案の変換
      const suggestions: Suggestion[] = [];
      if (issueData.suggestions && Array.isArray(issueData.suggestions)) {
        for (const suggestionData of issueData.suggestions) {
          if (suggestionData.text) {
            suggestions.push({
              text: suggestionData.text,
              rationale: suggestionData.rationale || 'LLMによる提案',
              confidence: Math.max(0, Math.min(1, suggestionData.confidence || 0.5)),
              isPreferred: suggestionData.isPreferred || false
            });
          }
        }
      }

      return {
        id: `llm_${issueData.id}_${Date.now()}`,
        source: 'llm',
        severity: this.validateSeverity(issueData.severity) || 'info',
        category: this.validateCategory(issueData.category) || 'style',
        message: issueData.message,
        range,
        suggestions,
        metadata: {
          llmGenerated: true,
          confidence: issueData.confidence || 0.5
        }
      };

    } catch (error) {
      console.warn('Issue 変換エラー:', error);
      return null;
    }
  }

  /**
   * 範囲を調整（passages内の相対位置に変換）
   */
  private adjustRange(range: { start: number; end: number }, passages: TextPassage[], positionMapping: { passageIndex: number; startOffset: number }[]): { start: number; end: number } | null {
    if (passages.length === 0 || positionMapping.length === 0) {
      return null;
    }

    // 範囲がどのパッセージに属するかを特定
    let targetPassageIndex = 0;
    for (let i = 0; i < positionMapping.length; i++) {
      const mapping = positionMapping[i];
      const passage = passages[mapping.passageIndex];
      const passageEnd = mapping.startOffset + passage.text.length;
      
      if (range.start >= mapping.startOffset && range.start < passageEnd) {
        targetPassageIndex = i;
        break;
      }
    }

    const targetMapping = positionMapping[targetPassageIndex];
    const targetPassage = passages[targetMapping.passageIndex];
    
    // パッセージ内の相対位置に変換
    const relativeStart = range.start - targetMapping.startOffset;
    const relativeEnd = range.end - targetMapping.startOffset;
    
    // パッセージの範囲内に収まるように調整
    const adjustedStart = Math.max(0, Math.min(relativeStart, targetPassage.text.length));
    const adjustedEnd = Math.max(0, Math.min(relativeEnd, targetPassage.text.length));
    
    if (adjustedStart >= adjustedEnd) {
      return null;
    }

    // 元のドキュメント内の絶対位置に変換
    return {
      start: targetPassage.range.start + adjustedStart,
      end: targetPassage.range.start + adjustedEnd
    };
  }

  /**
   * 重要度の検証
   */
  private validateSeverity(severity: any): 'info' | 'warn' | 'error' | null {
    if (typeof severity === 'string' && ['info', 'warn', 'error'].includes(severity)) {
      return severity as 'info' | 'warn' | 'error';
    }
    return null;
  }

  /**
   * カテゴリの検証
   */
  private validateCategory(category: any): 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk' | null {
    if (typeof category === 'string' && ['style', 'grammar', 'honorific', 'consistency', 'risk'].includes(category)) {
      return category as 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk';
    }
    return null;
  }

  /**
   * 設定を更新
   */
  updateConfig(config: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    maxSuggestions?: number;
  }): void {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl.replace(/\/$/, '');
    }
    if (config.apiKey !== undefined && typeof config.apiKey === 'string' && config.apiKey.length > 0) {
      this.apiKey = config.apiKey;
    }
    if (config.timeout !== undefined) {
      this.timeout = config.timeout;
    }
    if (config.maxSuggestions !== undefined) {
      this.maxSuggestions = config.maxSuggestions;
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testPrompt = 'こんにちは。これは接続テストです。';
      const response = await this.callGeminiAPI(testPrompt);
      
      return {
        success: response.success,
        error: response.error,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '接続テストエラー',
        responseTime: Date.now() - startTime
      };
    }
  }
}
