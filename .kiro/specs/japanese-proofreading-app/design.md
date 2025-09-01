# 設計書

## 概要

日本語文書校正支援アプリケーションは、Next.js 14とTailwind CSSで構築されたローカルWebアプリケーションで、ルールベース検出とオプションのLLM提案を組み合わせたハイブリッドテキスト解析を提供します。アプリケーションは、カードベースUI、豊富な余白、高いアクセシビリティ基準を持つモダンなSaaSダッシュボードデザインパターンに従います。

システムアーキテクチャは、テキスト解析、ルール管理、LLM統合のための統合APIルートを持つNext.jsフロントエンドで構成されます。すべての処理はローカルで行われ、ローカルGemini 2.5 Flash APIインスタンスへのオプション接続があります。

## アーキテクチャ

### システムアーキテクチャ

```mermaid
graph TB
    subgraph "ブラウザ"
        UI[Next.js 14 フロントエンド]
        Store[Zustand状態ストア]
    end
    
    subgraph "Next.js APIルート"
        LintAPI[/api/lint]
        SuggestAPI[/api/suggest]
        RulesAPI[/api/rules]
        SettingsAPI[/api/settings]
    end
    
    subgraph "コアサービス"
        RuleEngine[ルールエンジン]
        TextAnalyzer[テキスト解析器]
        LLMClient[LLMクライアント]
        RuleManager[ルール管理器]
    end
    
    subgraph "データ層"
        RuleFiles[YAMLルールファイル]
        LocalStorage[ブラウザローカルストレージ]
        Memory[インメモリキャッシュ]
    end
    
    subgraph "外部"
        GeminiAPI[ローカルGemini 2.5 Flash API]
    end
    
    UI --> Store
    UI --> LintAPI
    UI --> SuggestAPI
    UI --> RulesAPI
    UI --> SettingsAPI
    
    LintAPI --> RuleEngine
    LintAPI --> TextAnalyzer
    SuggestAPI --> LLMClient
    RulesAPI --> RuleManager
    
    RuleEngine --> RuleFiles
    RuleManager --> RuleFiles
    TextAnalyzer --> Memory
    LLMClient --> GeminiAPI
    
    SettingsAPI --> LocalStorage
```

### 技術スタック

- **フロントエンド**: Next.js 14 with App Router, React 18, TypeScript
- **スタイリング**: Tailwind CSS with custom design tokens
- **状態管理**: Zustand for client-side state
- **テキスト処理**: Custom rule engine with regex patterns
- **LLM統合**: HTTP client for local Gemini API
- **ストレージ**: Browser LocalStorage for settings, in-memory for text content
- **ビルドツール**: Next.js built-in bundling and optimization

## コンポーネント・インターフェース

### フロントエンドコンポーネント

#### コアレイアウトコンポーネント

**AppLayout**
```typescript
interface AppLayoutProps {
  children: React.ReactNode;
}
```
- ヘッダー、サイドバーナビゲーション、コンテンツエリアを持つメインアプリケーションシェルを提供
- モバイルファーストアプローチでレスポンシブデザインを実装
- グローバルキーボードショートカットとアクセシビリティフォーカスを管理

**Header**
```typescript
interface HeaderProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
  onOpenSettings: () => void;
}
```
- アプリブランディング、解析トリガーボタン、設定アクセスを含む
- 解析進行インジケーターを表示
- キーボードショートカット（解析用Ctrl+Enter）を実装

#### テキストエディターコンポーネント

**TextEditor**
```typescript
interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
  issues: Issue[];
  selectedIssue?: Issue;
  onIssueSelect: (issue: Issue) => void;
}
```
- 問題のシンタックスハイライト付きテキスト入力を管理
- テキスト選択とカーソル位置を処理
- 行番号と文字数を提供
- 下線とホバー状態で問題ハイライトを実装

**IssueHighlight**
```typescript
interface IssueHighlightProps {
  issue: Issue;
  isSelected: boolean;
  onClick: () => void;
}
```
- テキスト内の個別問題ハイライトをレンダリング
- 重要度レベルの視覚的フィードバックを提供
- 問題選択のクリックイベントを処理

#### 問題管理コンポーネント

**IssueList**
```typescript
interface IssueListProps {
  issues: Issue[];
  selectedIssue?: Issue;
  onIssueSelect: (issue: Issue) => void;
  filters: IssueFilters;
  onFiltersChange: (filters: IssueFilters) => void;
}
```
- 検出された問題のフィルタリング・ソート済みリストを表示
- カテゴリと重要度によるグループ化を提供
- 大きな問題リストに対する仮想スクロールを実装
- キーボードナビゲーションをサポート

**IssueDetail**
```typescript
interface IssueDetailProps {
  issue: Issue;
  onApply: (suggestion: Suggestion) => void;
  onDismiss: () => void;
}
```
- 説明付きの詳細問題情報を表示
- 根拠付きの複数修正提案を表示
- 適用と却下アクションを提供
- スクリーンリーダー用アクセシビリティ機能を実装

**IssueFilters**
```typescript
interface IssueFiltersProps {
  filters: IssueFilters;
  onChange: (filters: IssueFilters) => void;
  issueStats: IssueStats;
}
```
- 問題タイプ、重要度、カテゴリのフィルタリングコントロールを提供
- 問題数統計を表示
- 全フィルタクリア機能を実装

#### 設定コンポーネント

**SettingsModal**
```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```
- タブ付きインターフェースでアプリケーション設定を管理
- ルールセット選択とカスタマイズを処理
- LLM接続設定を提供
- フォーム検証とエラーハンドリングを実装

### API Interfaces

#### Lint API

**Request Interface**
```typescript
interface LintRequest {
  text: string;
  ruleset?: string;
  options?: {
    maxIssues?: number;
  };
}
```

**Response Interface**
```typescript
interface LintResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
    textLength: number;
    rulesetId: string;
  };
}
```

#### Suggest API

**Request Interface**
```typescript
interface SuggestRequest {
  passages: Array<{
    text: string;
    range: { start: number; end: number };
  }>;
  style: 'blog' | 'business' | 'academic';
}
```

**Response Interface**
```typescript
interface SuggestResponse {
  issues: Issue[];
  meta: {
    elapsedMs: number;
  };
}
```

### Core Data Models

#### Issue Model
```typescript
interface Issue {
  id: string;
  source: 'rule' | 'llm';
  severity: 'info' | 'warn' | 'error';
  category: 'style' | 'grammar' | 'honorific' | 'consistency' | 'risk';
  message: string;
  range: { start: number; end: number };
  suggestions: Suggestion[];
  ruleVersion?: string;
}
```

#### Suggestion Model
```typescript
interface Suggestion {
  text: string;
  rationale?: string;
  confidence?: number;
}
```

#### Rule Model
```typescript
interface Rule {
  id: string;
  severity: 'info' | 'warn' | 'error';
  category: string;
  pattern?: string;
  message: string;
  autoFix: boolean;
  replacement?: string;
}
```

## Data Models

### ルールファイル構造 (YAML)

```yaml
meta:
  id: "japanese-standard-v1.0.0"
  locale: "ja-JP"
  createdAt: "2025-01-01T00:00:00Z"
  author: "System"

rules:
  - id: "style.suru_koto_ga_dekiru"
    severity: "info"
    category: "style"
    pattern: "することができる"
    message: "「することができる」は「できる」に簡略化できます"
    autoFix: true
    replacement: "できる"
  
  - id: "grammar.ra_nuki"
    severity: "warn"
    category: "grammar"
    pattern: "見れる|食べれる|出れる"
    message: "ら抜き言葉です。正しい活用形を使用してください"
    autoFix: false
  
  - id: "honorific.double_honorific"
    severity: "error"
    category: "honorific"
    pattern: "お伺いさせていただく"
    message: "二重敬語です。「お伺いする」または「伺わせていただく」を使用してください"
    autoFix: false
```

### Settings Data Model

```typescript
interface AppSettings {
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
```

## エラーハンドリング

### エラーカテゴリと対応

#### テキスト処理エラー
- **文字数制限超過**: チャンク解析提案付きの警告バナーを表示
- **無効なテキストエンコーディング**: エラーメッセージを表示し入力のクリーンアップを試行
- **ルールエンジン障害**: 基本ルールにフォールバックしエラーをログ

#### LLM統合エラー
- **接続タイムアウト**: ルール結果を保持しながらLLM固有エラーを表示
- **無効なAPIキー**: 設定で設定エラーを表示
- **レート制限超過**: リクエストをキューに入れ進行インジケーターを表示

#### ルール管理エラー
- **ルールファイル破損**: デフォルトルールにフォールバックし警告を表示
- **ルール構文エラー**: 無効なルールをスキップし有効なルールで継続
- **ルール読み込み失敗**: キャッシュされたルールを使用し再読み込みを試行

### Error Recovery Strategies

```typescript
interface ErrorHandler {
  handleLintError(error: Error): Partial<LintResponse>;
  handleLLMError(error: Error): Partial<SuggestResponse>;
  handleRuleError(error: Error): Rule[];
  recoverFromFailure(operation: string): Promise<void>;
}
```

## テスト戦略

### 単体テスト
- **ルールエンジン**: 個別ルールパターンと置換をテスト
- **テキスト解析器**: テキスト解析と問題検出精度を検証
- **LLMクライアント**: API応答をモックしエラーハンドリングをテスト
- **コンポーネント**: ユーザー操作と状態管理をテスト

### 統合テスト
- **APIルート**: 完全なリクエスト/レスポンスサイクルをテスト
- **ルール読み込み**: YAML解析とルール適用を検証
- **設定永続化**: 設定保存/読み込み機能をテスト

### パフォーマンステスト
- **解析速度**: 2000文字でP95 < 5秒を検証
- **メモリ使用量**: 大きなテキストでのメモリ消費を監視
- **ルールエンジンパフォーマンス**: ルール実行時間をベンチマーク

### アクセシビリティテスト
- **キーボードナビゲーション**: 完全なキーボードのみ操作を検証
- **スクリーンリーダー互換性**: NVDA/JAWSでテスト
- **色コントラスト**: WCAG 2.1 AA準拠を検証
- **フォーカス管理**: 適切なフォーカスインジケーターを確保

### ユーザー受け入れテスト
- **修正採用率**: ≥60%の提案受け入れを目標
- **ルール検出精度**: ゴールド標準でF1 ≥ 0.70を達成
- **ユーザーワークフロー**: 完全な校正ワークフローを検証

## パフォーマンス最適化

### フロントエンド最適化
- **仮想スクロール**: 大きな問題リスト（>100項目）用
- **デバウンス解析**: 入力中の過度なAPI呼び出しを防止
- **メモ化コンポーネント**: 高コストなレンダリング操作をキャッシュ
- **コード分割**: 設定と高度機能の遅延読み込み

### バックエンド最適化
- **ルールキャッシュ**: コンパイル済み正規表現パターンをメモリにキャッシュ
- **テキストチャンク**: 大きなテキストを管理可能なセグメントで処理
- **リクエスト重複排除**: 重複LLMリクエストを防止
- **レスポンス圧縮**: APIレスポンスサイズを最小化

### メモリ管理
- **テキストコンテンツ**: 現在の文書のみをメモリに保持
- **問題キャッシュ**: キャッシュされた問題を現在のセッションに制限
- **ルールストレージ**: オンデマンドでルールを読み込み効率的にキャッシュ
- **LLMレスポンス**: TTL付きで最近の提案をキャッシュ

この設計は、パフォーマンス、アクセシビリティ、ユーザーエクスペリエンス基準を維持しながら、すべての必要機能を持つ日本語校正アプリケーションを実装するための堅実な基盤を提供します。