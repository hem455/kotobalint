# Project Structure

## Root Directory Organization
```
kousei/
├── CLAUDE.md                   # プロジェクトメインドキュメント
├── .claude/                    # Claude Code設定とコマンド
│   ├── commands/              # カスタムスラッシュコマンド
│   └── settings.local.json    # ローカル設定
└── .kiro/                     # Kiro SDD管理ディレクトリ
    ├── steering/              # ステアリング文書
    └── specs/                 # 仕様文書（今後作成）
```

## Subdirectory Structures

### `.claude/commands/`
Claude Codeのカスタムコマンド定義
```
commands/
└── kiro/
    ├── steering.md            # ステアリング管理コマンド
    └── steering-custom.md     # カスタムステアリング作成
```

### `.kiro/steering/`
プロジェクト全体のガイドライン文書
```
steering/
├── product.md                 # 製品概要と価値提案
├── tech.md                   # 技術スタックと環境
└── structure.md              # このファイル - プロジェクト構造
```

### `.kiro/specs/`（将来作成予定）
個別機能の仕様文書
```
specs/
├── [feature-name]/
│   ├── requirements.md        # 要件定義
│   ├── design.md             # 設計文書
│   └── tasks.md              # タスク分解
```

## Code Organization Patterns

### Naming Conventions
- **ディレクトリ**: kebab-case（例: `.kiro`, `steering-custom`）
- **ファイル**: kebab-case（例: `steering.md`, `settings.local.json`）
- **コマンド**: コロン区切り（例: `/kiro:steering`）

### Import Organization
- **Always Included**: `product.md`, `tech.md`, `structure.md`
- **Conditional**: ファイルパターンに基づく条件付き読み込み
- **Manual**: `@filename.md` 記法による手動参照

## Key Architectural Principles

### Document Hierarchy
1. **CLAUDE.md**: プロジェクトのエントリーポイント
2. **Steering Documents**: プロジェクト全体のコンテキスト
3. **Spec Documents**: 個別機能の詳細仕様

### Development Flow
1. **ステアリング作成**: `/kiro:steering`
2. **仕様初期化**: `/kiro:spec-init`
3. **段階的承認**: Requirements → Design → Tasks → Implementation

### File Management Strategy
- **分離原則**: ドキュメント、設定、仕様を明確に分離
- **階層化**: 用途別のディレクトリ構造
- **バージョン管理**: Git統合を前提とした構造

## Integration Points
- **Claude Code**: `.claude/` ディレクトリでの統合
- **AI Context**: ステアリング文書の自動読み込み
- **Command System**: スラッシュコマンドによる操作