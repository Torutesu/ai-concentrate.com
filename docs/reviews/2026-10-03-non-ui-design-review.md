# 非UI設計レビュー（2026-10-03）

- 対象: `codex/scalable-studio` @ `6620551`（UI・Figma・デザイン資産は対象外）
- 観点: AIネイティブ / スケーラビリティ / プライバシー・セキュリティ / トークン最適化 / マルチAI / その他（運用・品質・保守性）
- 重要度: **P0** = 壊れる・法的に出せない（最優先）、**P1** = 次の段階の前に直す、**P2** = 計画的に直す、**P3** = 衛生
- 各指摘は「現状（根拠のファイル:行）→ 問題 → 修正案 → 受け入れ条件」の順。修正案はそのままPRに分割できる粒度で書いた（§5）。

## 実装状況（同日追記）

このレビューの修正案を `claude/blissful-tesla-vlogr0` で実装しました。✅＝実装・テスト済み、△＝一部、—＝未着手。検証はローカル（D1・libSQL・プロバイダのダブル）までで、実プロバイダ・実MCPクライアント・本番デプロイは未検証です。

| 指摘 | 状態 | 内容 / 残り |
|---|---|---|
| SC-1 集約サイズ | ✅ | バイト予算をドメインで全書き込み経路に適用。プローブのシナリオは `AGGREGATE_TOO_LARGE` で止まる |
| SC-2 3重書き込み | ✅ | 受領書は `{productionId, revision}` のみ。revisions の差分化は SC-7 |
| SC-3 全文一括取得 | ✅ | 一覧は要約、本文は開いたときに取得（UIはデータ層のみ変更） |
| SC-4 Clerk API 毎回呼び出し | ✅ | API/MCP は `auth()` のみ |
| SC-5 ジョブ化 | — | 生成は同期のまま（50秒の締切内で最大1回フォールバック） |
| SC-6 検索 | ✅ | FTS5 trigram＋短語の部分一致、変更アイテムだけ再索引、一覧は要約列 |
| SC-7 アイテム正規化 | — | 未着手（スナップショットは256KB上限で有界） |
| SC-8 無期限テーブル | ✅ | 索引追加、日次パージ（Vercel Cron） |
| SC-9 二重ランタイム | △ | 未使用コード削除、`lib/platform/contract.ts` で互換性を明文化。Sites は AGENTS.md に従い維持 |
| PR-1 削除・保持 | ✅ | 資料・制作物・ワークスペース削除、30日猶予後の物理削除、Clerk `user.deleted` 連動 |
| PR-2 AI送信の統制 | ✅ | 送信先プロバイダ制限、資料送信オフ、資料ごとのAI除外、マスキング、取り込み時の警告。プライバシーポリシー文面は未作成 |
| PR-3 MCP認可 | △ | Clerk OAuth トークン受付、RFC 9728 メタデータ、スコープ。接続一覧・失効UIは未着手 |
| PR-4 監査ログ | ✅ | 全変更操作と拒否を `audit_events` に記録 |
| PR-5 上限 | △ | 月間トークン予算、ワークスペース・資料数の上限。書き込み全般のレート制限は未着手 |
| PR-6 インジェクション | ✅ | データブロック分離、数値・URLの警告、エージェント適用の制限 |
| TK-1〜TK-7 | ✅ | キャッシュ向けの並び＋キャッシュキー、関連チャンク選択、差分出力・動的出力上限、小さいMCP応答、`ai_runs`、tier別モデル |
| MA-1 プロバイダ | ✅ | OpenAI＋Claude（公式SDK）、ルーター、ポリシー。Google は未着手（追加はアダプタ1つ） |
| MA-2 MCP OAuth | ✅ | コード上は対応。実クライアントでの接続確認と CLI `login` は未実施 |
| MA-3 BYOモデル | ✅ | `change_propose` と MCP Prompts |
| MA-4 プロバイダ別調整 | — | eval で差が出たら追加 |
| AN-1 AIタスク | △ | `item.revise` をタスク化（版・tier・スキーマ）。他タスクは未着手 |
| AN-2 エージェント向けI/F | ✅ | 要約・範囲読み・検索・局所書き込み・具体的なエラー。`outputSchema`/Resources は未着手 |
| AN-3/AN-4/AN-6 | ✅ | スコープ、来歴、3-way 適用 |
| AN-5 フィードバック | △ | 採否は記録。適用後の手直し率は未計測 |
| AN-7 eval | △ | 7ケース＋決定的チェック＋実行スクリプト。LLM審査は未着手 |
| AN-8 ブランド知識 | △ | プロファイルを設定に保存しAIへ送信。編集UIは未着手（API/MCPのみ） |
| OT-1/OT-2/OT-4/OT-5/OT-6 | ✅ | CI、REST→共通Operation、提案のライフサイクル、衛生、AGENTS.md |
| OT-3 観測性 | △ | リクエストID、構造化エラーログ。メトリクス/OTelは未着手 |

UIはAGENTS.mdのFigma同期規則があるため、見た目を変えないデータ層の変更（3ファイル）に留めました。設定・削除・使用量の画面は未作成です。

---

## 0. 結論

**骨格は正しい。その上に載る層がまだ試作水準。**

「人もAIも同じ操作・同じ版管理・同じ権限を使う」という骨格（共通 Operation Registry、未適用の変更提案、revision の CAS、idempotency key、ロック、正直な capability 表示）は、AIネイティブなプロダクトの土台として良い設計です。

一方、その上に載る次の4つの層は試作段階で、実測で壊れる箇所もあります。

- AI実行層（タスク・モデル・コンテキストの管理）
- 外部エージェント向けインターフェース
- データ量の上限設計
- データのライフサイクル（削除・保持）

| 観点 | 評価 | 一言 |
|---|---|---|
| AIネイティブ | △ | 骨格は良い。ただしAIの仕事は「1アイテム全文の書き換え」1種類だけで、エージェント向けI/Fはトークン量的に実用にならない |
| スケーラビリティ | × | 集約サイズの上限が3か所で食い違っている。AI適用を重ねると保存不能になり、D1では `SQLITE_TOOBIG` が出る（**実測**） |
| プライバシー | × | 削除手段が一切ない。AIへの送信を統制する仕組み（同意・除外・マスキング）もない |
| トークン最適化 | × | 関連度に関係なく、毎回最大8万字のソースを送っている。並び順のせいでキャッシュが効かず、出力上限も本文上限と矛盾している |
| マルチAI | △ | Provider interface はあるが、実装・設定・スキーマはOpenAI専用。Vercel版の `/mcp` は外部AIのOAuthトークンを受け付けない（Clerkの実装で確認） |
| その他 | △ | CIなし、観測性なし。REST経路が共通Operationを迂回しており、ランタイムも二重 |

### 最優先（P0）

1. **SC-1** 集約サイズ上限の不整合。AI適用を重ねると、Web/MCPから保存できない制作物ができる（実測721KB > 300KB）。D1では書き込み自体が失敗する
2. **AN-2 / TK-4** MCP `context_list` が1レスポンス **18MB**（実測）。外部エージェントのコンテキストに入らず、事実上使えない
3. **MA-2** Vercel版 `/mcp` が Claude・ChatGPT・Cursor 等の OAuth トークンを受け付けない。それなのに `capabilities.mcp: true` を返している
4. **PR-1** 削除・保持期間の仕組みがない。外部ユーザーを受け入れる前に必須

### 次点（P1）

- **AI実行層の作り直し:** TK-1/2/3（キャッシュ・関連度選択・差分出力）、MA-1（プロバイダPort＋ルーター）、AN-4（来歴と使用量の記録）
- **エージェント運用の前提:** AN-3（適用権限の分離）、MA-3（クライアント側モデルで書いた提案の登録＝BYOモデル）
- **性能の前提:** SC-2（3重書き込み）、SC-3（全文の一括取得）、SC-4（毎リクエストの Clerk API 呼び出し）、SC-5（ジョブ化）
- **安全網:** OT-1（CI）

---

## 1. 範囲と検証方法

**読んだもの:** `lib/domain/*`, `lib/server/*`, `lib/agents/marketing.ts`, `lib/platform/*`, `db/schema.ts`, `drizzle/0000_*.sql`, `app/api/v1/**`, `app/mcp/route.ts`, `proxy.ts`, `cli/concentrate.mjs`, `tests/service.test.ts`, `scripts/{test,migrate-libsql}.mjs`, `vercel.json`, `docs/*.md`, `deployment/*.md`, `design/ux-v3/{AI-NATIVE-CONTRACT,REQUIREMENTS,COMMERCIAL-SPEC}.md`, `design/HANDOFF.md`, `AGENTS.md`。UIからは、サーバー呼び出しパターンの確認のため `components/studio/use-studio.ts` だけを参照した。

**実行したこと:**
- `npm test`: 17件 × D1/libSQL の両方で全件パス
- 追加プローブ: リポジトリ外のスクラッチで実行。アプリのコードは変更していない

| プローブ | 結果 |
|---|---|
| 12アイテムに各20,000字（日本語）のAI提案を順に適用 | 集約が **721,238 bytes** になり、Web/MCP保存の上限 300,000 bytes を超過。以後は `production_save` が 413 |
| 同上を60アイテムで実施（D1） | **36回目**の適用で `D1_ERROR: string or blob too big: SQLITE_TOOBIG`（直前の集約は 2,165,215 bytes）。HTTPでは 500 INTERNAL になる |
| 上記12回適用後のテーブル量 | `revisions` 4,695,379 B / `commands` 4,696,566 B。**同じ内容の二重保存**で、最終サイズの約13倍を書き込んでいる |
| MCP `context_list`（50ソース × 60,000字） | text 9,011,791 B ＋ structuredContent 9,011,800 B ＝ **18,025,301 B** |
| FTS5 `tokenize='trigram'` | D1・libSQLとも作成・MATCH・bm25 が動く。ただし**2文字以下のクエリはヒットしない**（例:「判断」） |
| Clerk `auth()` の既定 | `acceptsToken` の既定は `session_token`（`node_modules/@clerk/nextjs` の実装で確認）。OAuthトークンを受け付けるには明示指定が必要 |
| 付録Aのマイグレーション案 | D1・libSQLとも、既存0000の上に適用でき、既存行の埋め戻しも成功 |

**測っていないこと（推定値）:** トークン数（日本語は概ね1文字＝1トークン前後で、モデルのトークナイザによって変わる）。実プロバイダ呼び出しと負荷試験も未実施。

---

## 2. 維持すべき良い設計

ここは壊さないでください。修正案はすべてこれらの上に積む前提です。

1. **共通 Operation Registry**（`lib/domain/operations.ts`）
   - zod スキーマ1つから MCP の `inputSchema` を生成し、HTTP・MCP・CLI が同じ `executeOperation` を通る。
2. **AI出力は未適用の提案（ChangeSet）**
   - 適用には元 revision の一致が必要。人の判断を挟む設計がドメインに入っている。
3. **revision の CAS ＋ idempotency key ＋ 同一バッチでのスナップショット・受領書の記録**（`repository.ts:100-156`）
   - 並行保存と再送に強い。
4. **ロック**
   - 人が確定した部分をAIも人も勝手に変えられない。解除は別保存。
5. **生成の受付制御**（`repository.ts:288-341`）
   - 単一SQL文で原子的にテナント単位の上限をかけている。失敗した試行もカウントしている点も正しい。
6. **プロバイダのエラーを生で返さない**、`store: false`、秘密はサーバー側のみ。
7. **capability を正直に返す方針**と、ドキュメントで「未実装」を明記する文化。
8. **`Database` ポート**
   - D1/libSQL を同じ契約で検証できる。将来のDB変更（テナントごとのDBなど）にも効く。

---

## 3. 指摘と修正案

### 3.1 AIネイティブ

#### AN-1 [P1] AIの仕事が「1アイテムの全文書き換え」しかない

**現状**

AIの入口は `production_revise` → `generateProposal`（`lib/server/service.ts:180-243`）だけ。

`lib/domain/workflow.ts` の流れ（context → strategy → draft → calendar → analytics）のうち、AIが関わるのは draft の1アイテム編集だけです。次の作業はすべて人手のままです。

- ブリーフの抽出
- チャネル展開（原稿 → X / 記事 / Reddit / シーン / 手順）
- 主張と根拠の照合
- レビュー支援

**問題**

- 「AIが一次作業を担い、人が判断する」形になっていない。
- AI機能を足すたびに service に関数を増やす構造なので、タスクごとにモデル・出力スキーマ・プロンプト版・評価を持てない。

**修正案：AI Task Registry を Operation Registry と対で持つ**

```ts
// lib/ai/tasks.ts
export type ModelTier = "fast" | "standard" | "deep";
export interface AiTask<I, O> {
  id: string;            // "item.revise"
  version: string;       // "item.revise@2026-10-03.1"（プロンプトを変えたら必ず上げる）
  tier: ModelTier;
  input: z.ZodType<I>;
  output: z.ZodType<O>;  // プロバイダ非依存。各アダプタが自社の構造化出力形式に変換
  build(ctx: TaskContext<I>): PromptParts;
  maxOutputTokens(ctx: TaskContext<I>): number;
}
export interface PromptParts {
  system: string;          // 全ワークスペース共通・不変（キャッシュ対象）
  context: ContextBlock[]; // ワークスペース単位で安定：プロファイル・ソース抜粋（キャッシュ対象）
  task: string;            // 呼び出しごとに変わる：ブリーフ・対象本文・指示
}
```

最初に用意するタスク:

| task | tier | 出力 | 用途 |
|---|---|---|---|
| `item.revise` | standard | `{mode:"replace",body}` または `{mode:"edits",edits[]}` | 既存機能。差分出力に対応する（TK-3） |
| `item.derive` | standard | `{items:[{kind,locale,title,body}]}` | 原稿からチャネルへ展開。1回の呼び出しで複数案を作り、各案をChangeSetにする |
| `brief.extract` | standard | `{persona,problem,claim,…, evidence:[{field,chunkId}]}` | ソースからブリーフの下書きを作る（AN-8） |
| `claims.check` | fast | `{claims:[{text,status:"supported"\|"unsupported"\|"unknown",chunkIds[]}]}` | 公開前レビューの中身。`production_review` の構造チェックに足す |
| `source.summarize` | fast | `{summary,facts[]}` | 取り込み時に1回だけ実行し、以後の文脈注入に使う（TK-2） |

**受け入れ条件**
- 新しいAIタスクの追加が「Task定義1ファイル＋Operation登録1行」で済む。
- Web・MCP・CLIから同じ名前で呼べる。

---

#### AN-2 [P0] 外部エージェント向けI/Fがトークン量的に使えない

**現状**

- **`context_list` が全ソースの本文を返す**（`repository.ts:242-251`）。実測で18MB。
- **`production_get` が全アイテムの本文と履歴30件を返す**。
- **書き込みは集約全体の置換だけ**（`production_save`, `lib/domain/operations.ts:36`）。1行直すにも制作物全体（最大300KB）を送り返す必要がある。
- **エラーが具体的でない**。"Invalid tool arguments." / "Operation failed." だけ（`lib/server/mcp.ts:97-102`）。どのフィールドが悪いか分からないので、エージェントが自分で直せない。
- **`outputSchema` を宣言していない**。MCPの Resources / Prompts も提供していない。

**修正案：Operation v2（読み取りは小さく段階的に、書き込みは局所的に）**

読み取り:

| op | 返すもの |
|---|---|
| `context_list` | `id,name,kind,chars,tokenEstimate,hash,createdAt,aiExcluded`（本文なし）＋ cursor |
| `context_get` | `{sourceId, offset, limit≤8000字}` → 本文の一部＋`nextOffset` |
| `context_search` | `{query, limit≤10}` → チャンク抜粋（≤600字）＋`chunkId`＋score（SC-6） |
| `production_get` | ブリーフ＋`items[]:{id,kind,locale,title,locked,chars,hash}`（本文なし）＋revision |
| `item_get` | `{productionId,itemId,offset?,limit?}` → `body,hash,revision` |
| `change_list` | status フィルタ付き。`{id,itemId,status,createdAt,origin.kind,preview≤200字}` ＋ cursor |

書き込み:

| op | 入力 | 備考 |
|---|---|---|
| `item_patch` | `{productionId,itemId,baseHash, body \| edits[], idempotencyKey}` | アイテム単位の楽観ロック（AN-6） |
| `brief_patch` | `{productionId,baseRevision,fields:Partial<Brief>,idempotencyKey}` | |
| `item_add` / `item_remove` | | ロック中は削除不可 |
| `change_propose` | `{productionId,itemId,baseHash, after \| edits[], rationale?, declaredModel?}` | **クライアント側のモデルが書いた提案を登録する**（MA-3） |
| `change_reject` | `{changeId, reason?}` | フィードバックとして残す（AN-5） |

その他の変更:

- **エラーを具体的にする。** ZodError は `{code:"VALIDATION", issues:[{path:"source.body", message:"..."}]}` で返す。入力は呼び出し者自身のものなので、返しても漏洩にならない。HTTPの `handle()` も同様に変える。
- **`outputSchema` を出す。** Operation Registry に出力用の zod を追加し、`zodToJsonSchema` で生成する。
- **Prompts を配布する。** `revise-item` と `derive-channel` を用意し、`lib/agents/marketing.ts` のポリシーをそのまま配る。外部のモデルも同じ編集方針で書けるようになる（MA-3）。
- **Resources を用意する。** `concentrate://w/{ws}/production/{id}/brief`、`concentrate://w/{ws}/source/{id}`（テンプレート）。

**受け入れ条件**
- 典型的なエージェント作業（例:「Xの投稿を1本直して提案して」）が、往復合計 **1万トークン未満**で完了する。
- どのツールも既定の1応答が **8,000トークン以下**。

---

#### AN-3 [P1] エージェントが人のレビューを経ずに適用まで完遂できる

**現状**

「AI応答は未適用の提案で、人が適用する」が設計の要です。しかしMCPでは `production_revise` と `change_apply` が同じ権限で並んでいます。`readOnlyHint` などの annotations はヒントにすぎず、強制力がありません。

**問題**

外部エージェントが「生成 → 適用」を単独で完遂できます。プロンプトインジェクションを含むソースの影響が、そのまま本文に入りえます。

**修正案**

- **OAuthスコープを分ける:**

| スコープ | 許す操作 |
|---|---|
| `studio:read` | 読み取り |
| `studio:write` | `item_patch` などの直接編集 |
| `studio:propose` | `change_propose` |
| `studio:ai` | サーバー側生成（費用が発生する） |
| `studio:apply` | 提案の適用 |

- **ワークスペースのポリシー** `agentApply: "never" | "own_proposals" | "any"` を持たせ、既定は `never`。
- **`change_apply` の実行条件:** 人間のセッション、または `studio:apply` を持つクライアントだけ。
- Operation 定義に `requiredScopes` を追加し、`executeOperation` で一括検証する（ルートごとに書かない）。

**受け入れ条件**
- `studio:apply` を持たないOAuthトークンで `change_apply` を呼ぶと 403 になる。
- その試行が監査ログ（PR-4）に残る。

---

#### AN-4 [P1] 生成の来歴（provenance）が残らない

**現状**

`Change`（`lib/domain/models.ts:98-109`）には `instruction` と `sourceIds` しかありません。次の情報が残りません。

- モデル名
- プレイブックの版。`PLAYBOOK_VERSION` はプロバイダに送っているが、保存していない
- 使用トークン、所要時間
- どのクライアントから来たか

**問題**

モデル変更やプロンプト改訂の回帰比較、監査、原価計算ができません。

**修正案**

```ts
type ChangeOrigin =
  | { kind: "server_ai"; task: string; taskVersion: string; provider: string; model: string;
      runId: string; sourceChunkIds: string[]; promptHash: string }
  | { kind: "client_agent"; clientId: string; clientName: string; declaredModel?: string }
  | { kind: "human" };

type Change = {
  /* 既存の項目 */
  beforeHash: string;
  status: "proposed" | "applied" | "rejected" | "stale";
  origin: ChangeOrigin;
  createdBy: string;
  decidedBy?: string; decidedAt?: string; appliedRevision?: number;
  warnings?: string[]; // PR-6 の後検証の結果
};
```

`ai_runs` テーブル（TK-5）と `run_id` で結ぶ。DDLは付録A。

---

#### AN-5 [P2] フィードバックループがない

**現状**

- 提案の採否も、採用後にどれだけ手直しされたかも記録していない。
- `change_list` は、適用済み・陳腐化したものも区別せずに返す。

**修正案**

- AN-4 の `status` の遷移を記録する。
- 適用後の次回保存で、対象アイテムの文字差分率を `ai_runs` に書き戻す（`edit_ratio_after_apply`）。
- task × model × taskVersion の単位で、採用率と手直し率を週次で集計する。プロンプト改訂やモデル選定の判断材料にする。

これは学習ではなく計測です。`docs/marketing-agent-quality.md` の「生のエンゲージメントから自動学習しない」方針とは矛盾しません。

---

#### AN-6 [P2] 提案の陳腐化判定が粗く、並行編集でほとんどが無効になる

**現状**

`applyChange` は `current.revision !== change.baseRevision` だけでCONFLICTを返します（`models.ts:154`）。別のアイテムを1文字直しただけでも、他のアイテムへの提案はすべて適用できなくなります。

`docs/architecture.md` の「Later human edits survive」は、実際には「後の編集があれば提案は捨てる」という挙動です。

**問題**

人と複数のエージェントが同じ制作物を触る運用では、提案の大半が無駄になります。つまりトークンも無駄になります。

**修正案：3-way判定**

- Change に `beforeHash = sha256(対象アイテムの本文)` を保存する。
- 適用条件を「**対象アイテムの現在のハッシュ ＝ beforeHash** かつ未ロック」に変える。
- `production.revision` は、新しい revision の採番（CAS）にだけ使う。

```ts
export function applyChange(current: VersionedProduction, change: Change, currentItemHash: string): Production {
  if (current.workspaceId !== change.workspaceId || current.id !== change.productionId)
    throw new DomainError("NOT_FOUND", 404, "Target not found.");
  const item = current.data.items.find((x) => x.id === change.itemId);
  if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
  if (item.locked) throw new DomainError("LOCKED", 409, "This item is locked.");
  if (currentItemHash !== change.beforeHash)
    throw new DomainError("CONFLICT", 409, "The target text changed after this proposal was made.");
  return { ...current.data, items: current.data.items.map((x) => (x.id === item.id ? { ...x, body: change.after } : x)) };
}
```

既存テスト「stale proposal does not overwrite a later human edit」は同じアイテムを編集しているので、引き続き CONFLICT で通ります。「別アイテムの編集後でも適用できる」テストを追加してください。

---

#### AN-7 [P2] 評価（eval）がドキュメントにしかない

**現状**

`docs/marketing-agent-quality.md` に「固定ブリーフで比較する」方針はありますが、データセットも実行手段もありません。テストのプロバイダはダブル（偽物）です。

**修正案**

- **`evals/cases/*.json`:**
  - 中身: ブリーフ、ソース、指示、期待する性質
  - 禁止する性質の例: 捏造した数値、未提供の機能、架空の顧客の声
  - 必須の性質の例: CTA、出力ロケール、不明箇所のプレースホルダー
  - 文書に挙がっている7種類のケースを最初のセットにする（証拠が乏しい、ソース同士が矛盾、裏付けのない数値、ソース内のインジェクション、日本語X、英語Reddit、デモ台本）
- **`scripts/eval.mjs --task item.revise --models openai:<m>,anthropic:<m>`:**
  - 機械判定: 禁止パターン、ロケール判定、文字数、プレースホルダー
  - LLM審査: 別モデルに「ソースに無い主張」を列挙させる
  - 結果を `evals/results/<date>.json` に保存する
- **運用ルール:** モデル・プロンプト・Task の版を上げるPRには、eval の差分を必ず添付する（OT-6 で AGENTS.md に明記）。

---

#### AN-8 [P2] AIが参照すべき「ワークスペースの知識」がモデル化されていない

**現状**

`workspaces` テーブルには id / name / owner しかありません。`design/ux-v3/REQUIREMENTS.md` が求める次の情報はモデル化されていません。

- ブランドボイス、用語集、禁止表現
- ターゲット市場、制作言語
- 製品ファクト

ブリーフは制作物ごとに埋め込まれていて、共有できません。

**修正案**

- `workspace_profile` を revision 付きで持つ。中身は次のとおり。
  - `voice`
  - `glossary[{term, preferred, avoid[]}]`
  - `prohibitedClaims[]`
  - `markets[]`, `defaultContentLocales[]`
  - `productFacts[{fact, sourceChunkId, verified}]`
- AI Task の `context` ブロックの**先頭**に必ず入れる。小さくて安定しているので、キャッシュに向いている。
- `brief.extract` と `source.summarize` の出力は、プロファイルへの**変更提案**として出す。プロファイルの更新もAIが下書きし、人が承認する流れにそろえる。

---

### 3.2 スケーラビリティ

#### SC-1 [P0] 集約サイズの上限が3か所で食い違い、保存不能な制作物ができる（実測）

**現状**

| 上限 | 値 | 場所 |
|---|---|---|
| スキーマ | 本文20,000**字** × 100アイテム。日本語UTF-8で最大 約6MB | `models.ts:13,31` |
| HTTP/MCP入力 | 300,000 **bytes** | `http.ts:32` |
| D1の行・文字列サイズ | 約2MB | D1の制約 |

さらに、AI適用の経路（`apply`）は300KBの入力制限を通りません。

**実測**

- 12回の適用で集約が721KBになり、以後は Web/MCP の保存が 413 になる。
- D1では36回目の適用で `SQLITE_TOOBIG` になり、HTTPでは 500 INTERNAL が返る。

**修正案**

1. **ドメインで集約のバイト予算を定め、すべての書き込み経路で検証する**（save / restore / apply / item_patch / change_propose）。
   ```ts
   export const LIMITS = { itemBodyBytes: 48_000, aggregateBytes: 256_000, items: 100 } as const;
   const utf8 = (s: string) => new TextEncoder().encode(s).byteLength;
   export function assertAggregateBudget(p: Production) {
     if (p.items.some((i) => utf8(i.body) > LIMITS.itemBodyBytes))
       throw new DomainError("ITEM_TOO_LARGE", 413, `An item exceeds ${LIMITS.itemBodyBytes} bytes.`);
     if (utf8(JSON.stringify(p)) > LIMITS.aggregateBytes)
       throw new DomainError("AGGREGATE_TOO_LARGE", 413, `Production exceeds ${LIMITS.aggregateBytes} bytes.`);
   }
   ```
2. **本文の上限は文字数ではなくバイト数で決める。** 日本語と英語でバイト数が3倍違うため。HTTPの上限は「aggregateBytes ＋ エンベロープの余裕」として、ひとつの定数から導く。
3. **AI出力の検証**（`service.ts:223`）では、適用後の集約で予算をチェックする。超える提案は保存せず、`AGGREGATE_TOO_LARGE` を返す。
4. **既存データの是正:** 予算を超える既存の制作物を検出するスクリプトを用意する。保存はできないが、読み取りと分割はできる状態にする。
5. 中期的には SC-7（アイテムの正規化）で、集約全体を書き直す方式そのものをやめる。

**受け入れ条件**
- §1のプローブが `AGGREGATE_TOO_LARGE` で止まる。
- どの制作物も、常に Web から保存できる。

---

#### SC-2 [P1] 保存のたびに集約全体を3重に書いている

**現状**

保存バッチ（`repository.ts:121-146`）は次の3か所に書きます。

- `productions`: 本文
- `revisions`: 全文のスナップショット
- `commands.result`: VersionedProduction の全文

実測では、12回の適用で `revisions` 4.70MB と `commands` 4.70MB になり、両者は完全に同じ内容です。

**修正案**

- `commands.result` には `{"revision":n}` だけを保存する。再送（リプレイ）時は `revisions` から VersionedProduction を組み立て直す（`updatedAt` は `revisions.created_at`）。
- `commands` に `created_at` を追加し、7日でパージする。idempotency の窓としてはそれで十分。
- 中期的には SC-7 の content-addressed 化で、`revisions` も差分だけにする。

**効果**

書き込み量は約1/2〜1/3になります。Turso のストレージ量と書き込み課金に直接効きます。

---

#### SC-3 [P1] ワークスペースを開くたびに、全ソースと全提案の本文を取得している

**現状**

- `components/studio/use-studio.ts:117-120` が、ワークスペースを開くたびに次の2つを取得している。
  - `/sources`（最大50件 × 60,000字。実測で約9MB）
  - `/changes`（最大100件、`before`/`after` の全文）
- `production_review` は件数を数えるためだけに全ソースの本文を読んでいる（`lib/server/operations.ts:37`）。
- 生成時も、50件の全文をDBから読んで8件だけ使っている（`service.ts:206`）。

**修正案**

- 一覧は要約（AN-2 の `context_list` / `change_list`）に統一する。本文は選択したときに取る。
- 件数は `SELECT COUNT(*)` で取る。
- 生成時は、SC-6 の検索で必要なチャンクだけを読む。

---

#### SC-4 [P1] すべてのAPIリクエストで Clerk Backend API を呼んでいる

**現状**

`getUser()`（`lib/platform/runtime.ts:12-23`）は、ローカルでJWTを検証する `auth()` に加えて、`currentUser()` で毎回 Clerk Backend API にHTTPリクエストを送っています。しかしサービス層が使うのは `userId` だけです。

**問題**

- すべてのAPI・MCP呼び出しに、外部との往復が1回ずつ乗る。
- Clerk のレート制限に先に当たる。
- Clerk に障害が起きると、全APIが巻き込まれて止まる。

**修正案**

- `service()` では `auth()` の `userId` だけを使う（MA-2 の `getActor()` に統合）。
- 表示名やメールが必要な箇所（`app/page.tsx`）だけ `currentUser()` を呼ぶ。または、セッショントークンのカスタムクレームに含める。

---

#### SC-5 [P1] 生成が同期処理で、長い処理に拡張できない

**現状**

- プロバイダ呼び出しのタイムアウトは45秒（`openai-provider.ts:19`）、関数の上限は60秒（`vercel.json`）。
- キューもジョブの状態管理もない。`docs/architecture.md` も「durable job queue ではない」と明記している。

**問題**

次のような処理は60秒に収まりません。

- 推論モデルでの長文生成
- 複数アイテムへのチャネル展開（`item.derive`）
- ソースの要約
- 将来の音声・動画

また、途中で関数が落ちると、`generation_requests` が `running` のまま残ります。

**修正案（段階的に）**

1. **`jobs` テーブルを作る**（付録A）。状態遷移は `design/ux-v3/AI-NATIVE-CONTRACT.md` に合わせる（`queued → running → succeeded / failed / cancelled`）。
2. **生成APIは job を作って 202 と `jobId` を返す。** 実行は Next.js の `after()` で始め、`lease_until` を延長しながら進める。
3. **Vercel Cron で回収する。** 数分おきに lease 切れのジョブを再キューする。試行回数に上限を設け、プロバイダへの再送でも idempotency を保つ。
4. **Operation に `job_get` / `job_cancel` を足す。** Web はまずポーリングで追い、後で SSE にする。
5. **量が増えたらマネージドキューに替える**（Vercel のキュー/ワークフロー系、Inngest、QStash など）。`jobs` テーブルは状態ストアとして残し、実行基盤だけを差し替える。

---

#### SC-6 [P2] 検索がワークスペース内の全JSONを走査している

**現状**

- `repository.ts:181` が、`json_each` と `instr(lower(...))` で全制作物の全アイテムを毎回走査している。索引はない。
- 一覧表示でも、`title` / `plannedDate` / `itemCount` を毎回 `json_extract` で取り出している。

**修正案**

- **一覧用の列を持つ。** `productions` に `title`, `planned_date`, `item_count`, `size_bytes` の列を追加し、書き込み時に設定する。一覧はこれらの列だけを読む（付録A）。
- **FTS5（trigram）を追加する。** D1・libSQLとも動くことを確認済み。
  - trigram は**3文字未満にヒットしない**。2文字以下のクエリは、現行の部分一致にフォールバックする。
  - 保存バッチの中で、同じトランザクションで該当制作物の `search_docs` を差し替える。
  - 1〜2文字の語で検索したい場合は、`search_docs` に対する LIKE で足りる。対象は制作物数ではなくアイテム数なので、規模の見通しは立つ。
- **ソースにも同じ仕組みを使う。** ソースを約1,500字で `source_chunks` に分割して索引を作り、TK-2 の関連チャンク検索に使う。

---

#### SC-7 [P2] 集約が1列のJSONで、部分更新や差分保存ができない

**修正案（中期）**

```sql
CREATE TABLE blobs(workspace_id TEXT NOT NULL, hash TEXT NOT NULL, body TEXT NOT NULL,
                   PRIMARY KEY(workspace_id, hash));
CREATE TABLE production_items(workspace_id TEXT NOT NULL, production_id TEXT NOT NULL, item_id TEXT NOT NULL,
                   position INTEGER NOT NULL, kind TEXT NOT NULL, locale TEXT NOT NULL, title TEXT NOT NULL,
                   locked INTEGER NOT NULL, body_hash TEXT NOT NULL,
                   PRIMARY KEY(workspace_id, production_id, item_id));
-- revisions.data は {brief, items:[{id,kind,locale,title,locked,bodyHash}]} の manifest だけを持つ
```

**効果**

- 100アイテムの制作物で1件だけ直しても、書き込みは blob 1行と manifest だけ（数KB）で済む。
- `item_patch` と 3-way 適用（AN-6）が自然に書ける。
- ワークスペース単位でキーを持つので、削除（PR-1）も簡単になる。

---

#### SC-8 [P2] 無期限に増え続けるテーブルと、足りない索引

- **`generation_requests`:** 受付制御の `COUNT` が、`(workspace_id, created_at)` の索引なしで走査している（`db/schema.ts:102-113`）。索引を追加し、30日でパージする。
- **`commands`:** SC-2 のとおり。
- **`changes`:** `rejected` / `stale` になってから90日でパージする。
- パージは日次の Vercel Cron で、`jobs` の仕組みに載せて実行する。

---

#### SC-9 [P2] ランタイムが二重（Sites/D1 と Vercel/libSQL）

**現状**

- Vite の alias で `runtime.ts` と `sites.ts` を差し替えており、テストは2種類のDBで二重に実行している。
- 認証もゲートウェイのヘッダーと Clerk の2系統で、別物になっている。
- `db/index.ts`（Drizzle）と `examples/d1` は使われていない。
- Drizzle のスキーマはマイグレーション生成のためだけにあり、実際のクエリは生SQLで書かれている（ズレを検知する仕組みがない）。

**問題**

機能を足すたびに2系統で検証が要ります。D1の2MB制限のように、片方でしか壊れない不具合も出ます。

**修正案**

- 本番が Vercel なら、Sites を「参照用に凍結」し、新機能のテスト対象から外す日付を ADR で決める。
- `Database` ポートは残す（テナントごとのDBや別DBへの移行に効く）。
- 未使用のコードを削除する（OT-5）。
- Drizzle を使い続けるなら、`db/schema.ts` と実DB（マイグレーション適用後）の列を比較するテストを足す。

---

#### SC-10 [P3] 将来に向けた余地（今は不要）

- SQLite系は書き込みが単一ライター。数千ワークスペース規模までは単一の Turso DB で足りる見込み。
- テナント分離や大口顧客の要件が出たら、Turso のテナントごとのDBに `Database` ポートの裏で切り替えられるよう、ワークスペースIDからDBを引く `databaseFor(workspaceId)` の形にしておくと移行が楽になる。

---

### 3.3 プライバシー・セキュリティ

#### PR-1 [P0（外部ユーザー受け入れ前）] 何も削除できない

**現状**

- ソース・制作物・ワークスペース・メンバー・アカウントの、どの削除APIもない。
- ソースは「immutable」と定義されている（`docs/architecture.md`）。
- `revisions` / `commands` / `changes` に全文のコピーが無期限に残る。

**問題**

- **機密を誤って取り込むと取り消せない。** APIキーや顧客名簿を取り込んでしまっても消せず、最新8件に入っている間は、生成のたびに外部AIへ送られ続ける。
- **法的な請求に応じられない。** 個人情報保護法の利用停止・消去の請求、GDPRの消去権、退会処理のいずれにも対応できない。

**修正案**

- **Operation を追加する:**
  - `context_delete`（editor）
  - `production_delete`（editor）
  - `workspace_delete`（owner、再認証が必要）
  - `member_remove`（owner）
- **2段階で消す:**
  - `deleted_at` を立てた時点で、すべての読み取りとAI送信から即座に外す。
  - 日次のパージジョブが30日後に、関連する行を物理削除する（`revisions`, `commands`, `changes`, `search_docs`, `source_chunks`, `blobs`）。
  - `ai_runs` は本文を持たないので、集計用に残す。
- **アカウント削除と連動させる:** Clerk の `user.deleted` webhook でメンバーシップを削除する。そのユーザーが唯一の owner なら、`workspace_delete` のフローに入る。
- **保持期間を明文化する:** `docs/data-retention.md` に書く。

**データマップ（現状 → 提案）**

| データ | 保存場所 | 現状の複製数 | AIへの送信 | 提案する保持期間 |
|---|---|---|---|---|
| ソース本文 | sources | 1 | 最新8件 × 1万字を毎回 | 削除されるまで。削除後30日で物理削除 |
| 制作物本文 | productions / revisions / commands / changes | 最大4 | 対象アイテムのみ | commands 7日、changes 90日、revisions は削除まで |
| 指示文 | changes | 1 | 毎回 | changes と同じ |
| userId | memberships, revisions.actor_id | — | なし | アカウント削除時に匿名化 |
| メール・氏名 | Clerk のみ（**DBに持たない点は良い**） | — | なし | — |

---

#### PR-2 [P1] AIへのデータ送信が統制されていない

**現状**

ワークスペースのソースのうち最新8件（各1万字）が、生成のたびに OpenAI（米国）へ送られます。`store:false` は良い設定ですが、次の仕組みがありません。

- ワークスペース単位での同意
- 送信先の選択
- ソース単位の除外
- 秘密情報のマスキング

**修正案**

- **`workspace_ai_policy` を owner が設定できるようにする:**
  - `allowedProviders[]`
  - `requireZeroRetention`
  - `sendSources: "all" | "selected" | "none"`
  - ルーター（MA-1）は、この許可リストの外にはルーティングしない。
- **ソース単位で除外できるようにする:** `sources.ai_excluded` を追加（付録A）。
- **送信前にスクラバーを通す**（ContextBuilder の中で）:
  - 対象: APIキーらしき文字列（`sk-`, `AKIA`, `ghp_`, `xox[bp]-`, PEMブロック）、メールアドレス、日本の電話番号
  - 該当部分を `[REDACTED:kind]` に置き換え、件数を `ai_runs.redactions` に記録する。
  - 取り込み時にも同じ検出を走らせ、「秘密情報らしきものが含まれています」と警告を返す。
- **プライバシーポリシーに書く:** 「AI処理の委託先と所在国」を記載する。一覧は `allowedProviders` から生成する。

---

#### PR-3 [P1] MCPの認可が外部クライアントを想定していない

根本の原因は MA-2 と同じです。ここではスコープと失効の観点を扱います。AN-3 のスコープと MA-2 の OAuth 対応に加えて、次を行います。

- **`agent_connections` テーブルを作る**（`client_id, user_id, workspace_ids[], scopes, created_at, last_used_at, revoked_at`）。
  - 接続ごとに、対象ワークスペースを限定できるようにする。REQUIREMENTS.md の「導入画面で対象workspaceと操作範囲を表示」の受け皿になる。
- **失効を二重にチェックする。** 失効したクライアントは、Clerk 側の失効とローカルの `revoked_at` の両方で拒否する。

---

#### PR-4 [P2] 監査ログがない

**現状**

`revisions.actor_id` しか残りません。どのクライアント（Web / CLI / MCP、MCPならクライアント名）が、どの操作を行い、成功したか失敗したかが分かりません。

**修正案**

- `audit_events` テーブルを作る（付録A）。本文は入れない。
- `executeOperation` の共通ラッパー1か所で記録する。

---

#### PR-5 [P2] レート制限・利用上限が「生成の回数」だけ

**現状**

- 生成はワークスペースごとに「同時2件・24時間で100回」まで。
- **しかしワークスペースは無制限に作れるので、作り直せばこの上限を迂回できる。**
- `context_import`（1件60,000字）・保存・検索（全件走査）には制限がない。

**修正案**

- **ユーザー単位の月間トークン予算を主とし、回数制限は従にする。** 予算は `ai_runs` から集計する。
- **ワークスペースの作成数に上限を設ける**（例: ユーザーあたり20）。
- **書き込み系にトークンバケットを設ける**（ユーザー単位）。最初は libSQL 上のカウンタで十分。規模が出たら Upstash などに移す。

---

#### PR-6 [P2] プロンプトインジェクション対策が1層しかない

**現状**

- ソースは、指示と同じ入力のJSON文字列の一部として送られる（`openai-provider.ts:25`）。
- 対策はシステム指示の1文だけ。
- 最後の防御は「人が適用する」ゲートだが、AN-3 のとおりMCPでは迂回できる。

**修正案**

1. **ソースを明示的なデータブロックとして分ける。** `<source id="…" trust="untrusted">…</source>` の形で、別の入力アイテムにする。
2. **出力を後から検証する。** ソースにも元本文にも無い URL・数値・固有名詞を検出したら、Change の `warnings[]` に入れ、UIで強調する。
3. **AN-3 のスコープを入れる。**

---

### 3.4 トークン最適化

#### TK-1 [P1] キャッシュが効かない並び順になっている

**現状**

入力は次の順で並んでいます（`service.ts:208-222`, `openai-provider.ts:24-25`）。

1. `instructions`（約400トークン。チャネルの種類で変わる）
2. `input = JSON.stringify(input)`: title, kind, playbookVersion, brief, sourceCoverage, locale, body, instruction, sources の順

最も大きい部分（ソース。最大8万字）が、毎回変わる本文と指示の**後ろ**にあります。

**問題**

プロバイダのプロンプトキャッシュは、先頭からの一致で効きます。今の並びでは先頭の数百トークンしか一致しないため、ソースの部分は毎回、通常料金とフルのレイテンシがかかります。

**修正案：安定したものから可変のものへ並べ替える（`PromptParts`）**

```
[system]  共通の編集ポリシー（全ワークスペース共通・不変）              ← キャッシュ対象
[context] ワークスペースプロファイル(AN-8) ＋ ソース抜粋（ソース集合ハッシュ単位で不変）  ← キャッシュ対象
[task]    チャネル方針、ブリーフ、対象本文、指示                        ← 毎回変わる
```

- **OpenAI:**
  - `prompt_cache_key = ws:{workspaceId}:{contextHash}` を指定する。
  - チャネル方針は `instructions` から task 側へ移し、`instructions` を全チャネル共通にする。
  - 推論モデルを使う場合は `reasoning.effort` もタスク定義で指定する（TK-3）。
- **キャッシュを明示的に指定する方式のプロバイダ**（Anthropic など）では、system と context の末尾にキャッシュのブレークポイントを置く。アダプタが `caps.promptCache` を見て処理する。
- `ai_runs.cached_input_tokens` でヒット率を監視する。

**目標**

同じワークスペースで続けて編集するとき、入力の70%以上がキャッシュに当たること。

---

#### TK-2 [P1] 関連度に関係なく、毎回「最新8件 × 1万字」を送っている

**現状**

`service.ts:206-221` は最新のソース8件を選び、それぞれ先頭から1万字で切っています。

- 「最新」が「関連がある」とは限らない。
- 先頭から切るので、各ソースの後半は常に送られない。

**修正案：ContextBuilder**

1. **取り込み時に準備する。** `source_chunks`（約1,500字ごと）を作り、`source.summarize`（fast tier）を1回だけ実行する。
2. **生成時に検索する。** 「指示＋ブリーフ（claim / problem）＋対象本文の冒頭」をクエリにして、FTS（SC-6）で上位のチャンクを取る。制作物に**固定（pinned）**されたソースは優先する。
3. **トークン予算まで詰める。** 例えば6,000トークンまでチャンクを入れ、足りない文脈はソースの要約で補う。
4. **使ったチャンクを記録する。** `Change.origin.sourceChunkIds` に残し、出典の表示と監査に使う。

**見込み**

入力トークンは1/5〜1/10程度になり、関連性はむしろ上がります（推定。§1の注記のとおり、トークン数は実測していない）。

---

#### TK-3 [P1] 出力が常に全文の書き換えで、しかも出力上限が本文上限と矛盾している

**現状**

- 出力は `{body}` の全文（`openai-provider.ts:27-37`）。
- `max_output_tokens: 3500`（`openai-provider.ts:23`）なのに、本文の上限は20,000字。
- 日本語で数千字ある本文を全文書き換えると出力上限に達し、`status !== "completed"` になって `INCOMPLETE`（502）が返る。
- 推論モデルでは、推論トークンもこの上限を消費する。

**修正案**

- **出力スキーマを2つのモードにする:**
  ```ts
  const reviseOutput = z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("replace"), body: z.string() }),
    z.object({ mode: z.literal("edits"),
               edits: z.array(z.object({ find: z.string().min(1), replace: z.string() })).max(50) }),
  ]);
  ```
  - 本文が1,500字以上なら `edits` モードを指示する。
  - サーバーで適用する。各 `find` が本文中にちょうど1回出現しなければ `INVALID_OUTPUT` にする。
  - 出力トークンが「変更した量」に比例するようになる。
- **出力上限を動的に決める:**
  - `clamp(estimateTokens(body) * 1.3 + 500, 800, model.maxOutput)`
  - 推論モデルは `reasoning.effort: "low"` を既定にし、タスク定義で上書きできるようにする。
- **出力上限による打ち切りを区別する:** `incomplete_details.reason === "max_output_tokens"` のときは `OUTPUT_LIMIT` という別のエラーコードを返す。UIには「差分モードで再試行」の選択肢を出す。

---

#### TK-4 [P0] MCPの応答が巨大（AN-2 と同じ根）

MCPの仕様は、後方互換のため `structuredContent` と同じJSONを `text` にも入れることを推奨しています。なので二重化自体は残します。直すべきなのは**1応答の大きさ**です（要約・ページング・本文の分離取得）。

**目安**

- どのツールも、既定の1応答は8,000トークン以下にする。
- 超える場合は cursor を返す。

---

#### TK-5 [P2] 使用量を記録していない

**現状**

プロバイダの応答に含まれる `usage` を捨てています（`openai-provider.ts:73-83`）。

**修正案**

- `ai_runs` テーブル（付録A）に、入力・キャッシュ済み入力・出力・推論の各トークン数、レイテンシ、エラーコード、試行回数を記録する。
- 料金は `config/models.json`（MA-1）の単価から算出し、`cost_micros` に入れる。
- 同じテーブルを、PR-5 の予算、MA-1 のルーティング評価、AN-5 の採用率の集計に共用する。

---

#### TK-6 [P2] タスクに関係なく1つのモデルを使っている

**現状**

`OPENAI_MODEL` が1つあるだけです。

**修正案**

tier（fast / standard / deep）ごとにモデルを設定します。

| tier | 使う場面 |
|---|---|
| fast | Xの短文、要約、主張チェック |
| standard | 記事、チャネル展開 |
| deep | 戦略、難しい改稿 |

---

#### TK-7 [P3] 細かい無駄

- 空のブリーフ項目も送っている → 空の項目は省く。
- task 部分を `JSON.stringify` しているため、本文の改行や引用符がエスケープされる → プレーンテキストと区切りタグで渡す。
- `sourceCoverage` と `playbookVersion` はモデルには不要 → 記録は `ai_runs` 側に移す。

---

### 3.5 マルチAI

#### MA-1 [P1] 実装が OpenAI Responses API 専用

**現状**

- `aiConfig()` が読むのは `OPENAI_API_KEY` と `OPENAI_MODEL` だけ。
- URL、リクエスト形式、json_schema の指定、エラー変換は、すべて `openai-provider.ts` に直接書かれている。
- `GenerationProvider.revise()` は string を返すだけで、使用量・実際のモデル名・終了理由を返せない（`service.ts:167-179`）。

**修正案：Model Provider Port ＋ Router**

```ts
// lib/ai/provider.ts
export interface ModelProvider {
  readonly id: string; // "openai" | "anthropic" | "google" | "gateway"
  readonly caps: { structuredOutput: "native" | "tool" | "none"; promptCache: "auto" | "explicit" | "none" };
  generate(req: {
    model: string; parts: PromptParts; schema: JsonSchema; maxOutputTokens: number;
    reasoning?: "none" | "low" | "medium"; cacheKey?: string; signal: AbortSignal;
  }): Promise<{ output: unknown; usage: Usage; model: string;
                finish: "stop" | "length" | "filtered"; providerRequestId?: string }>;
}
export type Usage = { inputTokens: number; cachedInputTokens: number; outputTokens: number; reasoningTokens: number };

// lib/ai/router.ts
export async function runTask<I, O>(task: AiTask<I, O>, ctx: TaskContext<I>, policy: WorkspaceAiPolicy): Promise<O> {
  const candidates = registry.route(task.tier).filter((m) => policy.allowedProviders.includes(m.provider));
  if (!candidates.length) throw new DomainError("AI_POLICY", 403, "No permitted model for this task.");
  for (const [i, m] of candidates.slice(0, 2).entries()) {
    try {
      return await attempt(m, task, ctx);              // 試行ごとに ai_runs に1行記録する
    } catch (e) {
      if (i === 1 || !isRetryableBeforeOutput(e)) throw e;
    }
  }
  throw new Error("unreachable");
}
```

**方針**

- **フォールバックの条件:** 出力が返る前の失敗（接続失敗、429、5xx、最初の応答前のタイムアウト）に限り、**最大1回**。出力がスキーマに合わない場合は別モデルに回さない（品質問題を隠さないため）。
- **`config/models.json`:** provider、model、tier、maxContext、maxOutput、単価、caps を持つ。環境変数には APIキーだけを置く。
- **アダプタ:** OpenAI（現行コードを移植）、Anthropic、Google。
  - 自前で書く代わりに、Vercel の AI SDK や AI Gateway を使う選択肢もある。Vercel 上で動いているので相性が良く、キー管理・フォールバック・使用量の集計をまとめて任せられる。
  - どちらを選んでも**この Port の内側に閉じ込め**、ドメイン層はSDKに依存させない。
- **出力スキーマ:** zod で定義し（AN-1）、各アダプタが自社の構造化出力形式（ネイティブの JSON Schema 指定、またはツール入力スキーマ）に変換する。
- **BYOK（任意）:** ワークスペースごとに自社のキーを持ち込めるようにする。キーはDBに封筒暗号化で保存し、鍵暗号化鍵（KEK）は環境変数に置く。

**受け入れ条件**
- 同じ eval ケース（AN-7）を、2社以上のモデルで実行できる。
- ワークスペースのポリシーで送信先を制限すると、許可外のプロバイダは呼ばれない。

---

#### MA-2 [P0] Vercel版 `/mcp` が外部AIのOAuthトークンを受け付けない

**現状**

- `service()` → `getUser()` → Clerk の `auth()` の順で認証している。
- `auth()` の既定は `acceptsToken: "session_token"` だけ（`node_modules/@clerk/nextjs` の実装で確認）。そのため、Claude・ChatGPT・Cursor 等の MCP クライアントが持つ **OAuth アクセストークンは 401** になる。
- Protected Resource Metadata（`/.well-known/oauth-protected-resource`）がない。401 の応答に `WWW-Authenticate` も付かないので、クライアントは認可フローを始められない。
- それなのに `/api/v1/capabilities` は無条件に `mcp: true` を返す（`app/api/v1/capabilities/route.ts:17`）。
- CLI の既定URLは旧 Sites のホストを指している（`cli/concentrate.mjs:13`）。

**修正案**

1. **`getActor(request)` を新設する**（SC-4 もここに統合する）。
   ```ts
   const a = await auth({ acceptsToken: ["session_token", "oauth_token"] });
   if (!a.isAuthenticated) return null;
   return a.tokenType === "oauth_token"
     ? { userId: a.userId, channel: "mcp", clientId: a.clientId, scopes: a.scopes }
     : { userId: a.userId, channel: "web", clientId: null, scopes: HUMAN_SCOPES };
   ```
   `userId` / `clientId` / `scopes` が OAuth トークン用の認証オブジェクトにあることは、Clerk の型で確認済み。
2. **Protected Resource Metadata を実装する。** `/.well-known/oauth-protected-resource` を用意し、`authorization_servers` に Clerk のホスト、`resource` に `https://<host>/mcp` を入れる。401 の応答には `WWW-Authenticate: Bearer resource_metadata="…"` を付ける。トークンの audience（宛先）も検証する。
3. **スコープを検証する。** Operation ごとに必要なスコープを宣言し、`executeOperation` で検証する（AN-3）。
4. **capability を実態どおりにする。** 例: `mcp: { available: oauthConfigured, auth: "oauth" }`。
5. **実機で確認する。** 主要な MCP クライアント（Claude、ChatGPT、Cursor / Claude Code など）で「接続 → ツール一覧 → 読み取り → `change_propose`」まで通し、`docs/release-readiness.md` に記録する。
6. **CLI を直す。**
   - `concentrate login`（OAuth の PKCE ＋ ループバック）を追加する。
   - 既定URLを Vercel の本番URLに変える。
   - `--json` と終了コードを AI-NATIVE-CONTRACT.md に合わせる。

---

#### MA-3 [P1] 外部AIが自分で書いた提案を登録できない（BYOモデル）

**現状**

MCPから文章を作らせる手段は、`production_revise`（サーバーが OpenAI を呼ぶ）だけです。Claude などのクライアントは自分自身が強力なモデルなのに、わざわざサーバー側で別のモデルを呼び、しかもその費用をサーバー側が負担しています。

**修正案：`change_propose`（AN-2）と MCP Prompts でプレイブックを配る**

**流れ**
1. クライアントは `item_get` / `context_search` で必要な材料を読む。
2. 自分のモデルで書き、プロンプトはサーバーが配ったプレイブックに従う。
3. `change_propose` で提案として登録する。
4. 人が Web でレビューして適用する。

**利点**
- サーバー側のトークン費用がゼロになる。
- ユーザーは好きなAIを使える。
- それでも、版管理・ロック・レビューは共通のまま保たれる。
- 提案の出どころは `origin.kind = "client_agent"` で区別できる（AN-4）。

**位置づけ**
- サーバー側生成（`production_revise`）は、AIを持たないクライアント（Web、CLI）向けと、品質を保証したいタスク向けに残す。
- MCP の sampling は対応しているクライアントが限られるので、後回しでよい。

---

#### MA-4 [P2] プロンプトをプロバイダ別・ロケール別に調整できない

**現状**

システム指示は英語の1本だけです。日本語の出力品質は、モデルによる差が大きいです。

**修正案**

- タスク定義に `build(ctx, providerCaps)` の形で、プロバイダ別の微調整フックを持たせる。ただし使うのは、eval で差が確認できた場合だけ。
- ポリシーの本文は共通に保つ（`lib/agents/marketing.ts` を一次ソースにする）。

---

### 3.6 その他（運用・品質・保守性）

#### OT-1 [P1] CIがない

**現状**

`.github/` がなく、テスト・型チェック・lint・ビルドはすべて手動です。複数のコーディングエージェント（Codex / Claude など）が並行して手を入れる運用では、CIが唯一の安全網になります。

**修正案**

GitHub Actions の `ci.yml` を追加します。

- Node 22 で `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm test`（D1・libSQL）→ `npm run build:vercel`
- 空のDBに `drizzle/*.sql` を全部適用するテストも入れる。

---

#### OT-2 [P2] REST経路が共通Operationを迂回している

**現状**

Web は `/api/v1/workspaces/...` の個別ルートを使っていて、各ルートが StudioService を直接呼んでいます。その結果、MCPと挙動が食い違っています。

- `POST /workspaces` はランダムなUUIDで作成するので、再送すると重複して作られる（`app/api/v1/workspaces/route.ts:16`）。MCP版は明示IDなので冪等。
- `GET /productions` は検索クエリを無視する。

**問題**

AI-NATIVE-CONTRACT.md の「同じ操作なら同じ結果」が、Web と MCP の間で崩れます。

**修正案**

- RESTのルートを `executeOperation` の薄いアダプタにする（あるいは Web も `/operations` に寄せる）。
- Operation の一覧から REST / MCP / CLI の対応表を生成する。
- 「同じ入力なら同じ出力」を確かめるパリティテストを追加する。

---

#### OT-3 [P2] 観測性がない

**現状**

ログもリクエストIDもメトリクスもありません。想定外の例外は INTERNAL に丸められ、どこにも記録されません（`lib/server/http.ts:52-79`）。

**修正案**

- リクエストIDを生成し、応答ヘッダー・ログ・`audit_events`・`ai_runs` に通す。
- DomainError 以外は構造化ログに出す（スタック、operation 名、workspaceId。本文は入れない）。
- Vercel のログ / Observability、または OpenTelemetry に送る。
- SLO の例: API の p95 < 500ms（生成を除く）、生成の成功率 > 97%。

---

#### OT-4 [P2] 提案（Change）にライフサイクルがない

**現状**

- 適用済み・陳腐化・却下の区別がない。
- 適用をリプレイすると、古いスナップショットがそのまま返る。クライアントがそれを最新と誤認しうる。

**修正案**

- AN-4 の `status` を入れる。
- リプレイの応答には `replayed: true` と現在の revision を含める。

---

#### OT-5 [P3] リポジトリの衛生

- `package.json` の name が `site-creator-vinext-starter` のまま。
- `tsconfig.tsbuildinfo` がコミットされている → `.gitignore` に入れる。
- 未使用のコード: `lib/content.ts`（旧プロトタイプの `makePrompt` など）、`db/index.ts`、`examples/d1`。Sites 専用の `lib/connectors.ts` 系は SC-9 の判断に従う。
- `docs/architecture.md` の冒頭（「MCPサーバーは公開しない」）と後半の追記が矛盾している。最新の状態を冒頭に書き、履歴は末尾か CHANGELOG に移す。

---

#### OT-6 [P2] AGENTS.md に非UIの不変条件がない

**現状**

AGENTS.md にあるのは Figma 同期の規則だけです。コーディングエージェントが守るべきアーキテクチャの不変条件が書かれていません。

**修正案：AGENTS.md に以下を追記する**

- すべての操作は `lib/domain/operations.ts` に登録し、`executeOperation` を経由する。ルートから StudioService を直接呼ばない。
- 書き込みには `baseRevision` または `baseHash` と、`idempotencyKey` が必須。
- AI呼び出しは `lib/ai/router` 経由だけ。プロバイダのSDKを直接 import しない。必ず `ai_runs` に記録する。
- スキーマ変更はマイグレーションの追加だけで行い、適用済みのSQLは編集しない。
- 1応答の上限（TK-4）と集約の予算（SC-1）を超えるAPIを作らない。
- AIタスクやプロンプトを変えたら、eval の結果を添付する。

---

## 4. 目標アーキテクチャ

```
 Web UI ── REST adapter ─┐
 CLI (login: PKCE) ──────┤
 MCP clients ────────────┤   Auth: Clerk session | OAuth token(+scopes)
 (Claude/ChatGPT/Cursor) ┘          └─► Actor { userId, channel, clientId, scopes }
                          ▼
            Operation Registry  (zod in/out, requiredScopes, annotations, cost class)
                          ▼
            executeOperation ── request-id / audit_events / rate limit / budget
                          ▼
            StudioService  (authz, CAS, idempotency, locks, 3-way apply, size budget)
        ┌─────────────────┼──────────────────────────────┐
   Repository        AI Orchestrator                    Jobs
   (libSQL)          ├ Task Registry (versioned)        jobs table + after()
   ├ productions     ├ ContextBuilder                   + cron lease recovery
   ├ items / blobs   │   profile, FTS chunks,           → managed queue later
   ├ search_fts      │   token budget, redaction
   ├ source_chunks   ├ Router (tier, policy, fallback≤1)
   ├ changes         ├ Provider adapters
   ├ ai_runs         │   OpenAI / Anthropic / Google | Gateway
   ├ audit_events    └ ai_runs (usage, cost, provenance)
   └ jobs
```

---

## 5. 実装ロードマップ（PR単位）

| # | PR | 対応する指摘 | 規模 | 依存 |
|---|---|---|---|---|
| 1 | 集約のバイト予算を全書き込み経路で検証し、既存の超過を検出 | SC-1 | S | — |
| 2 | `context_list` / `change_list` を要約化。`context_get` / `item_get` を追加し、`production_get` から本文を外す（Web側も対応） | AN-2, TK-4, SC-3 | M | — |
| 3 | `getUser` を `auth()` だけにする | SC-4 | S | — |
| 4 | CI を追加 | OT-1 | S | — |
| 5 | `commands.result` を縮約し `created_at` とパージを追加。`generation_requests` に索引 | SC-2, SC-8 | S | 4 |
| 6 | Zod の issue をエラーに含める。capability を実態どおりにする | AN-2, MA-2 | S | — |
| 7 | AI Port / Task Registry / `ai_runs`。OpenAIアダプタの移植、プロンプトの並べ替え、出力上限の動的化、差分モード | MA-1, AN-1, AN-4, TK-1, TK-3, TK-5 | L | 1 |
| 8 | Change に `beforeHash` / `status` / `origin`。3-way 適用、`change_reject` | AN-4, AN-5, AN-6, OT-4 | M | 7 |
| 9 | MCP の OAuth（`acceptsToken`、PRM、`WWW-Authenticate`）、スコープ、`agent_connections` | MA-2, AN-3, PR-3 | M | 6 |
| 10 | `item_patch` / `brief_patch` / `change_propose`。MCP の prompts / resources / outputSchema | AN-2, MA-3 | M | 8, 9 |
| 11 | 削除・保持期間・パージジョブ。データ保持ドキュメント | PR-1 | M | 5 |
| 12 | `workspace_ai_policy`、`ai_excluded`、スクラバー、出力の後検証 | PR-2, PR-6 | M | 7 |
| 13 | FTS5 検索、`source_chunks`、ContextBuilder | SC-6, TK-2 | M | 7 |
| 14 | `jobs`（生成の非同期化） | SC-5 | M | 7 |
| 15 | Anthropic / Google アダプタ（または Gateway）、ルーター、フォールバック | MA-1, TK-6 | M | 7 |
| 16 | eval ハーネス | AN-7, MA-4 | M | 15 |
| 17 | `audit_events`、予算とレート制限 | PR-4, PR-5 | M | 7, 9 |
| 18 | アイテムの正規化と content-addressed な revisions | SC-7 | L | 8 |
| 19 | `workspace_profile`、`brief.extract` / `source.summarize` | AN-8, AN-1 | M | 13 |
| 20 | Sites ランタイム凍結の ADR、未使用コードの削除、AGENTS.md への追記 | SC-9, OT-5, OT-6 | S | — |

**着手順の目安**

- **1〜6**（P0と安価なP1）は互いに独立していて、すぐに並行して進められる。
- **7** が以降のAI関連の土台になる。
- **9 → 10** で「外部AIから安全に使える」状態になる。
- **11** は外部ユーザーを受け入れる前に必須。

---

## 付録A：追加マイグレーション案（`0001`）

PR 5 / 7 / 8 / 11 / 12 / 13 / 14 / 17 に対応する案です。D1 と libSQL の両方で、既存の `0000` の上に適用できることを確認しました（既存行の `title` / `item_count` / `changes.item_id` の埋め戻しも成功）。実際に導入するときは PR ごとに分割し、`drizzle/` に1本ずつ追加してください。**適用済みの `0000` は編集しないでください。**

```sql
-- commands の縮約・パージ（SC-2）、受付制御の索引（SC-8）
ALTER TABLE commands ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
CREATE INDEX command_created ON commands(created_at);
CREATE INDEX generation_ws_created ON generation_requests(workspace_id, created_at);

-- 一覧用の列（SC-6）、サイズの監視（SC-1）、論理削除（PR-1）
ALTER TABLE productions ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE productions ADD COLUMN planned_date TEXT NOT NULL DEFAULT '';
ALTER TABLE productions ADD COLUMN item_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productions ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productions ADD COLUMN deleted_at TEXT;
UPDATE productions SET title=json_extract(data,'$.title'), planned_date=json_extract(data,'$.plannedDate'),
  item_count=json_array_length(data,'$.items'), size_bytes=length(CAST(data AS BLOB));
ALTER TABLE sources ADD COLUMN ai_excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN deleted_at TEXT;
ALTER TABLE workspaces ADD COLUMN deleted_at TEXT;

-- 提案のライフサイクルと来歴（AN-4/5/6）
ALTER TABLE changes ADD COLUMN status TEXT NOT NULL DEFAULT 'proposed';
ALTER TABLE changes ADD COLUMN item_id TEXT;
ALTER TABLE changes ADD COLUMN before_hash TEXT;
ALTER TABLE changes ADD COLUMN origin_kind TEXT NOT NULL DEFAULT 'server_ai';
ALTER TABLE changes ADD COLUMN run_id TEXT;
ALTER TABLE changes ADD COLUMN decided_by TEXT;
ALTER TABLE changes ADD COLUMN decided_at TEXT;
UPDATE changes SET item_id=json_extract(data,'$.itemId');
CREATE INDEX change_status ON changes(workspace_id, status, created_at);

-- AIの実行記録（TK-5, AN-4, PR-5）
CREATE TABLE ai_runs (
  id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
  channel TEXT NOT NULL, client_id TEXT, task TEXT NOT NULL, task_version TEXT NOT NULL,
  provider TEXT NOT NULL, model TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL,
  input_tokens INTEGER, cached_input_tokens INTEGER, output_tokens INTEGER, reasoning_tokens INTEGER,
  cost_micros INTEGER, latency_ms INTEGER, error_code TEXT, redactions INTEGER NOT NULL DEFAULT 0,
  context_hash TEXT, created_at TEXT NOT NULL
);
CREATE INDEX ai_runs_ws_created ON ai_runs(workspace_id, created_at);
CREATE INDEX ai_runs_actor_created ON ai_runs(actor_id, created_at);

-- 監査（PR-4）
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT, actor_id TEXT NOT NULL, channel TEXT NOT NULL,
  client_id TEXT, operation TEXT NOT NULL, target_id TEXT, outcome TEXT NOT NULL, error_code TEXT,
  request_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX audit_ws_created ON audit_events(workspace_id, created_at);

-- ジョブ（SC-5）
CREATE TABLE jobs (
  id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, input_hash TEXT NOT NULL, status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0, lease_until TEXT, progress REAL, result_ref TEXT, error_code TEXT,
  created_by TEXT NOT NULL, client_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, idempotency_key)
);
CREATE INDEX jobs_status_lease ON jobs(status, lease_until);

-- 関連チャンク検索（TK-2）と全文検索（SC-6）。trigram は3文字以上のクエリ用
CREATE TABLE source_chunks (
  rowid INTEGER PRIMARY KEY, workspace_id TEXT NOT NULL, source_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL, body TEXT NOT NULL, hash TEXT NOT NULL, UNIQUE(source_id, ordinal)
);
CREATE INDEX source_chunks_ws ON source_chunks(workspace_id, source_id);
CREATE VIRTUAL TABLE source_chunks_fts USING fts5(body, content='source_chunks', content_rowid='rowid', tokenize='trigram');
CREATE TABLE search_docs (
  rowid INTEGER PRIMARY KEY, workspace_id TEXT NOT NULL, production_id TEXT NOT NULL, item_id TEXT, body TEXT NOT NULL
);
CREATE INDEX search_docs_ws ON search_docs(workspace_id, production_id);
CREATE VIRTUAL TABLE search_fts USING fts5(body, content='search_docs', content_rowid='rowid', tokenize='trigram');
```

**注意（外部コンテンツ型の FTS5）**

`content=` を指定した FTS5 は、本体テーブルを更新しても索引が自動では追従しません。本体テーブルの INSERT / DELETE と同じバッチの中で、`*_fts` 側の INSERT と `'delete'` コマンドを必ず発行してください。トリガーでも書けますが、D1 / libSQL の両方でテストしてから採用してください。

---

## 付録B：再現プローブの要点

`tests/service.test.ts` と同じハーネス（Miniflare D1 / libSQL のインメモリ）で、次を実行しました。

1. **SC-1:** 12アイテムの制作物を作り、`generateProposal`（プロバイダはダブルで、20,000字の日本語を返す）→ `apply` を全アイテムに繰り返した。その後の `PUT` 本体のバイト数と、`revisions` / `commands` の `SUM(length(CAST(... AS BLOB)))` を測った。60アイテム版では、D1 で `SQLITE_TOOBIG` になった回を記録した。
2. **AN-2:** `addSource` で60,000字のソースを50件入れ、`dispatchMcp` で `tools/call context_list` を呼び、応答のバイト数を測った。
3. **SC-6:** 両方のDBに `fts5(..., tokenize='trigram')` を作り、`MATCH` と `bm25()` が動くこと、2文字のクエリが0件になることを確認した。
4. **付録A:** `0000` の上に付録AのSQLを適用し、既存行の埋め戻しを両方のDBで確認した。

これらのプローブは、修正PRの回帰テストとしてそのまま `tests/` に移せます。たとえばSC-1なら「適用が `AGGREGATE_TOO_LARGE` で止まり、制作物は常に保存できる」ことを確かめるテストになります。
