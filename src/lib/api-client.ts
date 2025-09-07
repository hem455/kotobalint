import type {
  LintRequest,
  LintResponse,
  SuggestRequest,
  SuggestResponse,
  AppSettings,
  TextPassage,
  ContentStyle
} from '@/types';

// APIクライアントクラス
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * テキストの校正解析を実行
   */
  async lintText(request: LintRequest): Promise<LintResponse> {
    const response = await fetch(`${this.baseUrl}/api/lint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Lint API エラー');
    }

    return data.data;
  }

  /**
   * LLMによる校正提案を生成
   */
  async generateSuggestions(request: SuggestRequest): Promise<SuggestResponse> {
    const response = await fetch(`${this.baseUrl}/api/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Suggest API エラー');
    }

    return data.data;
  }

  /**
   * ルールセット一覧を取得
   */
  async getRules() {
    const response = await fetch(`${this.baseUrl}/api/rules`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Rules API エラー');
    }

    return data.data;
  }

  /**
   * ルールセットを切り替え
   */
  async switchRuleSet(ruleSetId: string) {
    const response = await fetch(`${this.baseUrl}/api/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ruleSetId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Rule switch API エラー');
    }

    return data.data;
  }

  /**
   * 個別ルールの有効/無効を切り替え
   */
  async toggleRule(ruleId: string, enabled: boolean) {
    const response = await fetch(`${this.baseUrl}/api/rules/${ruleId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Rule toggle API エラー');
    }

    return data.data;
  }

  /**
   * 設定を取得
   */
  async getSettings(): Promise<AppSettings> {
    const response = await fetch(`${this.baseUrl}/api/settings`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Settings API エラー');
    }

    return data.data;
  }

  /**
   * 設定を保存
   */
  async saveSettings(settings: Partial<AppSettings>) {
    const response = await fetch(`${this.baseUrl}/api/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Settings save API エラー');
    }

    return data.data;
  }

  /**
   * ヘルスチェック
   */
  async healthCheck() {
    try {
      const [lintResponse, suggestResponse] = await Promise.all([
        fetch(`${this.baseUrl}/api/lint`),
        fetch(`${this.baseUrl}/api/suggest`)
      ]);

      return {
        lint: lintResponse.ok,
        suggest: suggestResponse.ok,
        overall: lintResponse.ok && suggestResponse.ok
      };
    } catch (error) {
      return {
        lint: false,
        suggest: false,
        overall: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// デフォルトのAPIクライアントインスタンス
export const apiClient = new ApiClient();

// テキストからTextPassage配列を生成するヘルパー関数
export function createTextPassages(
  text: string, 
  ranges: Array<{ start: number; end: number }>
): TextPassage[] {
  return ranges.map(range => ({
    text: text.slice(range.start, range.end),
    range
  }));
}

// テキストの一部を抽出してLLM提案を生成するヘルパー関数
export async function generateSuggestionsForText(
  text: string,
  style: ContentStyle = 'business',
  maxLength: number = 1000
): Promise<SuggestResponse> {
  // テキストが長すぎる場合は最初の部分を抽出
  const targetText = text.length > maxLength ? text.slice(0, maxLength) : text;
  
  const passages: TextPassage[] = [{
    text: targetText,
    range: { start: 0, end: targetText.length }
  }];

  return apiClient.generateSuggestions({
    passages,
    style
  });
}
