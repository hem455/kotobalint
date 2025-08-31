# Technology Stack

## Architecture
- **フレームワーク**: Claude Code Spec-Driven Development (cc-sdd)
- **AI統合**: Anthropic Claude Sonnet 4
- **プラットフォーム**: Windows (win32)
- **開発言語**: 日本語回答生成 / 英語思考プロセス

## Development Environment
- **Claude Code**: AI支援開発環境
- **Node.js**: npxによるパッケージ実行
- **Git**: バージョン管理（現在は非Gitリポジトリ）

## Framework Components
- **cc-sdd**: Claude Code Spec-Driven Development
  - バージョン: 1.0.0-beta.4
  - 日本語サポート: `--lang ja`
  - インストール: `npx cc-sdd@latest`

## Common Commands
- **初期セットアップ**: `npx cc-sdd@latest --lang ja --yes`
- **ステアリング管理**: `/kiro:steering`
- **カスタムステアリング**: `/kiro:steering-custom`
- **仕様初期化**: `/kiro:spec-init [description]`

## File Organization
- **ステアリング文書**: `.kiro/steering/`
- **仕様文書**: `.kiro/specs/`
- **Claude Codeコマンド**: `.claude/commands/`
- **設定ファイル**: `.claude/settings.local.json`

## Development Workflow
1. **Phase 0**: ステアリング文書作成（オプション）
2. **Phase 1**: 仕様作成（Requirements → Design → Tasks）
3. **Phase 2**: 進捗追跡と実装

## Configuration
- **言語設定**: 日本語出力優先
- **思考言語**: 英語
- **出力形式**: Markdown対応
- **文字エンコーディング**: UTF-8