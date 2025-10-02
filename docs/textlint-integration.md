# textlintルール統合ガイド

## 概要

kotobalintは textlint のルールセットを参考にした3段階プリセットシステムを実装しています。
約58個のルール（Light: 8, Standard: 18, Strict: 32）を提供し、用途に応じて選択できます。

## プリセット一覧

### 🟢 Light プリセット（リアルタイム校正向け）

**対象**: SNS投稿、チャット、メール下書き
**処理時間**: <1秒
**ルール数**: 8個

#### 含まれるルール
1. 助詞の重複（が・を・に）
2. 二重否定
3. ら抜き言葉（食べれる→食べられる）
4. 冗長表現（することができる→できる）
5. 全角英数字
6. 読点の過剰使用（4個以上）
7. 二重敬語
8. 長文検出（120文字超）

#### 使用例
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"これは食べれるテストです。","preset":"light"}'
```

---

### 🟡 Standard プリセット（推奨・バランス型）

**対象**: 技術文書、ブログ記事、ビジネス文書
**処理時間**: 1-3秒
**ルール数**: 18個（Light + 10個）

#### 追加ルール
9. 連続漢字の長さ制限（7文字以上）
10. 形式名詞のひらがな表記（事→こと、時→とき）
11. 弱い表現の検出（〜かもしれません）
12. 同じ接続詞の繰り返し
13. 文体の混在検出（です・ます調/である調）
14. 連続する空白
15. 同じ単語の連続
16. 断定的表現（必ず、絶対）
17. 比較優位表現（最高、最も）
18. （Lightプリセットのすべてを含む）

#### 使用例
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"情報処理技術者試験に合格することができる。","preset":"standard"}'
```

**検出例**:
- 「情報処理技術者試験」→ 連続漢字8文字（7文字以上を警告）
- 「することができる」→ 冗長表現（「できる」に簡略化可能）

---

### 🔴 Strict プリセット（最終校正向け）

**対象**: 出版物、公式文書、プレスリリース
**処理時間**: 3-5秒
**ルール数**: 32個（Standard + 14個）

#### 追加ルール
19. より厳格な文長制限（100文字）
20. より厳格な読点制限（3個以上）
21. カタカナ長音表記の統一（コンピュータ→コンピューター）
22. 同上（ユーザ→ユーザー）
23. 冗長表現（〜の方）
24. 冗長表現（〜について）
25. 無駄な副詞（基本的に、一般的に）
26. 半角カタカナの検出
27. 不自然な括弧の使用
28. 「〜たり〜たり」の不完全な使用
29. ゼロ幅スペースの検出
30. 丸括弧・角括弧の対応チェック
31. ら抜き言葉（見れる→見られる）
32. ら抜き言葉（来れる→来られる）

#### 使用例
```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"コンピュータでユーザ登録ができます。","preset":"strict"}'
```

**検出例**:
- 「コンピュータ」→ 「コンピューター」（長音表記の統一）
- 「ユーザ」→ 「ユーザー」（長音表記の統一）

---

## API仕様

### POST /api/analyze

テキストをルールベースで解析します。

**リクエストボディ**:
```json
{
  "text": "解析対象のテキスト",
  "preset": "light" | "standard" | "strict",
  "enabledCategories": ["style", "grammar", "honorific", "consistency", "risk"],
  "enabledSeverities": ["info", "warn", "error"]
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": "grammar.ranuki_tabereru_3_7",
        "source": "rule",
        "severity": "warn",
        "category": "grammar",
        "message": "「食べれる」はら抜き言葉です。「食べられる」を検討してください",
        "range": { "start": 3, "end": 7 },
        "suggestions": [
          {
            "text": "食べられる",
            "rationale": "自動修正を適用します"
          }
        ]
      }
    ],
    "meta": {
      "elapsedMs": 2,
      "preset": "light",
      "rulesApplied": 1,
      "issuesFound": 1
    }
  }
}
```

### GET /api/analyze

利用可能なプリセット情報を取得します。

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "presets": [
      {
        "name": "light",
        "meta": {
          "id": "preset-light-v1.0.0",
          "name": "Lightプリセット（リアルタイム校正向け）",
          "performance": "fast"
        },
        "stats": {
          "totalRules": 8,
          "byCategory": { "grammar": 3, "style": 4, "honorific": 1 },
          "bySeverity": { "info": 5, "warn": 3 },
          "autoFixableCount": 3
        }
      }
    ]
  }
}
```

---

## パフォーマンス比較

| プリセット | ルール数 | 平均処理時間 | メモリ使用量 | 推奨用途 |
|-----------|---------|-------------|-------------|---------|
| Light | 8 | <1秒 | 低 | リアルタイム入力支援 |
| Standard | 18 | 1-3秒 | 中 | 技術文書・ブログ |
| Strict | 32 | 3-5秒 | 高 | 最終校正・出版物 |

---

## カスタムプリセットの作成

### ステップ1: YAMLファイルの作成

`src/rules/presets/custom-preset.yaml` を作成：

```yaml
meta:
  id: "preset-custom-v1.0.0"
  version: "1.0.0"
  locale: "ja-JP"
  name: "カスタムプリセット"
  description: "プロジェクト専用のルールセット"
  performance: "balanced"
  targetUseCase: "社内文書"

rules:
  - id: "custom.company_terms"
    severity: "warn"
    category: "consistency"
    pattern: "御社"
    message: "「御社」ではなく「貴社」を使用してください"
    autoFix: true
    replacement: "貴社"
    enabled: true
    examples:
      - before: "御社の製品"
        after: "貴社の製品"
```

### ステップ2: プリセットローダーに登録

```typescript
import { PresetLoader } from '@/lib/preset-loader';

const loader = new PresetLoader();
const customPreset = await loader.loadCustomPreset('./path/to/custom-preset.yaml');
```

---

## textlintとの互換性

### 参考にしたtextlintルール

| kotobalintルール | textlint元ルール | 実装状況 |
|-----------------|-----------------|---------|
| `grammar.particle_repetition` | `textlint-rule-no-doubled-joshi` | ✅ 実装済み |
| `grammar.ranuki_*` | `textlint-rule-no-dropping-the-ra` | ✅ 実装済み |
| `style.max_kanji_continuous` | `textlint-rule-max-kanji-continuous-len` | ✅ 実装済み |
| `style.max_reading_points_*` | `textlint-rule-max-ten` | ✅ 実装済み |
| `style.mixed_writing_style_*` | `textlint-rule-no-mix-dearu-desumasu` | ✅ 実装済み |
| `style.hiragana_formal_noun_*` | `textlint-rule-ja-hiragana-keishikimeishi` | ✅ 実装済み |

### textlintプリセットとの対応

- **Light** ≒ `preset-ja-spacing` + 基本ルール
- **Standard** ≒ `preset-ja-technical-writing`
- **Strict** ≒ `preset-ja-technical-writing` + `preset-JTF-style`

---

## トラブルシューティング

### 問題: ルールが検出されない

```bash
# デバッグ: プリセット情報を確認
curl http://localhost:3001/api/analyze

# 解決策: プリセットキャッシュをクリア
# src/lib/preset-loader.ts の clearCache() を呼び出す
```

### 問題: 文字化けが発生する

```bash
# ❌ 間違い: curlでエンコーディング指定なし
curl -X POST http://localhost:3001/api/analyze -d '{"text":"日本語"}'

# ✅ 正しい: Content-Typeでcharsetを指定
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json; charset=UTF-8" \
  -d '{"text":"日本語"}'
```

### 問題: パフォーマンスが遅い

1. より軽いプリセットを使用（Strict → Standard → Light）
2. `enabledCategories` で不要なカテゴリを除外
3. `maxIssues` で検出数を制限

```json
{
  "text": "テキスト",
  "preset": "light",
  "enabledCategories": ["grammar", "style"],
  "enabledSeverities": ["warn", "error"]
}
```

---

## 今後の拡張予定

### Phase 2: 追加ルール候補（20ルール）
- `ja-no-inappropriate-words`: 不適切語チェック
- `ja-no-abusage`: 誤用表現の検出
- `ja-no-successive-word`: 同一単語の連続使用
- `ja-space-between-half-and-full-width`: 半角・全角間のスペース
- `prefer-tari-tari`: 〜たり〜たり構文の統一

### Phase 3: AI統合
- LLM提案とルールベース検出の併用
- プリセット選択をUIで可能に
- ユーザーカスタムルールの管理画面

---

## ライセンス

kotobalintのルールプリセットは textlint のオープンソースルールを参考に独自実装しています。
各ルールの `source` フィールドで元となったtextlintルールを記載しています。

- textlint: MIT License
- kotobalint: MIT License (予定)

---

## 参考リンク

- [textlint公式サイト](https://textlint.github.io/)
- [textlintルール集](https://github.com/textlint/textlint/wiki/Collection-of-textlint-rule)
- [preset-ja-technical-writing](https://github.com/textlint-ja/textlint-rule-preset-ja-technical-writing)
- [SmartHR用プリセット](https://github.com/kufu/textlint-rule-preset-smarthr)
