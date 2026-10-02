# Concentrate の Web CLI MCP 共通操作仕様

設計案。CLIバイナリ、MCPサーバー、生成・収録・公開機能は未実装。以下のコマンドとツール名はConcentrateの提案仕様であり、実行可能な既存APIではない。

## 共通の操作基盤

Web / CLI / MCP → 認証・ワークスペース権限 → 共通Commandサービス → 版管理・ジョブ・イベント → 制作物ストア。

AIだけが別の制作物を作る構造にしない。人が画面で編集しても、AIがCLI/MCPで編集しても、同じID、同じ履歴、同じアクセス制御を利用する。MCPは外部AIがConcentrateを操作する入口。SNS/CMS等への外向き接続とは方向を区別する。Cluesoを必須バックエンドにはしない。

## 保存する単位

- Workspace：製品、ブランド、役割、予算、連携先、制作言語。UI言語は個人設定。
- ContextSnapshot：URL/MD/repoの元情報、取得時刻、content hash、commit、出典位置、確認状態。
- Brief：読者、目的、主張、根拠、制約、採用した戦略。
- Production：企画への参照、recipe revision、成果物群と承認状態。
- Scene：不変ID、素材、台本、字幕、同期点、レイヤー、マスク、演出、手動ロック。
- DocumentStep：scene ID、該当素材の時刻、本文、画像注釈。
- Variant：原版revision、言語、縦横比、対象媒体、用語集revision、独自変更。
- Job：開始者とclient、対象revision、進捗、子ジョブ、費用、成果物、エラー、中止状態。
- ChangeSet：生成された部分変更、元revision、影響範囲、承認者、適用revision。
- Artifact / Publication：書き出し元revisionと設定hash、保存先、公開先、予約時刻、外部ID。

## コマンドとMCPの対応

全操作にworkspace_idを明示する。対話CLIの既定workspaceは補助であり、CIとMCPの書き込みは明示必須。操作を曖昧な万能executeにまとめない。

| 操作 | CLI案 | MCPツール案 | 結果 |
| --- | --- | --- | --- |
| 検索・能力確認 | workspace list / capabilities | workspace_list / capability_get | ページ付き一覧、提供可能な操作 |
| 文脈取り込み | context import --file product.md | context_import | source ID / job ID |
| 文脈の固定 | context snapshot | context_snapshot | snapshot ID |
| 戦略の作成 | strategy propose --snapshot ID | strategy_propose | 変更案 / job ID |
| 制作計画 | production plan --brief ID | production_plan | 計画、必要素材、費用見積り |
| 素材の取り込み | asset upload --file demo.mov | asset_upload_prepare / asset_upload_finish | upload URL / asset ID |
| 収録 | capture start --plan ID | capture_start | job ID |
| 構造の取得 | production get --id ID | production_get | scenes / variants / revisions |
| 部分編集 | scene patch --file patch.json | scene_patch | change set |
| AIで部分修正 | production revise --scene ID --instruction … | production_revise | change set / job ID |
| 音声 | voice generate --scene ID | voice_generate | job ID |
| 同期 | scene sync --id ID | scene_sync | change set / job ID |
| 生成素材 | asset generate --brief ID | asset_generate | job ID |
| 手順書 | document derive --production ID | document_derive | linked document / job ID |
| 言語・媒体展開 | variant create --locale en --aspect 9:16 | variant_create | variant / job ID |
| レシピ | recipe save --production ID | recipe_save | immutable recipe revision |
| 更新影響 | impact check --snapshot ID | impact_check | affected scenes / steps / variants |
| 差分の取得・適用 | change get / change apply | change_get / change_apply | diff / new revision |
| コメント | review comment --scene ID --at 12.4 | review_comment | comment ID |
| レビュー | review request / review approve | review_request / review_approve | revision-bound review |
| 書き出し | export start --production ID | export_start | job ID |
| 公開計画 | publication plan --artifact ID | publication_plan | destination / cost / content hash |
| 公開・予約 | publication execute --plan ID | publication_execute | publication ID / job ID |
| 実行監視 | job get / job watch / job cancel | job_get / job_events / job_cancel | 状態、イベント、部分成果物 |
| 接続管理 | connection list / connection revoke | connection_list / connection_revoke | connection metadata |

各コマンドはJSON Schemaで入力を定義する。MCPには同じ入力・出力schemaと操作の副作用を公開する。サーバーの認可はツールの説明文やannotationとは独立して検証する。[MCP Tools仕様](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

## 書き込みと長時間処理

変更入力の共通項目は workspace_id、target_id、base_revision、idempotency_key。AI編集はまずChangeSetを作り、apply時に競合を確認する。手動ロックされた要素は変更案の対象外。ロック解除は明示操作。

ジョブは queued → running → succeeded / partially_succeeded / failed / cancelled。認証やレビュー待ちは needs_input / awaiting_approval。結果にはjob_id、status、phase、progress、cost、artifact_refs、error、retryable、resume_cursorを含める。不明な進捗はnullで返し、推定百分率を捏造しない。

再試行は失敗した子ジョブだけを選ぶ。idempotency_keyが同じ場合は既存実行を返し、二重課金・二重公開を避ける。中止は協調的で、完了済み成果物と消費済み費用を保持する。書き出しは確定revisionを読むため、その間に最新版を編集できる。

CLIは --json で機械可読stdout、ログはstderr。--no-inputでは対話せずneeds_inputを構造化エラーで返す。長時間処理は既定でjob IDを返し、--wait / job watchで追跡。SIGINTはwatchの終了とジョブの中止を区別する。APIバージョンを固定し、unknown fieldを黙って捨てない。

## MCPの接続と認可

リモートMCPを主方式とし、認証はOAuthベース。導入画面は対象workspaceと操作範囲を表示する。認可済みclientごとに最終利用・権限・失効を管理する。HTTPの認証・discovery・token audience等は採用時点のMCP仕様に準拠して実装する。[MCP Authorization仕様](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

MCP Resourcesは、context snapshot、brand guide、用語集、recipe、production manifest、job statusを必要な範囲で提供。ページネーション、field selection、短いpreviewを備え、動画バイナリをtool responseに埋め込まない。短期artifact URLにはアクセス制御を適用する。

公開・削除・連携権限拡張は、通常の下書き編集と別scope。レビュー承認は本人の権限で検証し、任意のapproved=trueでは通さない。公開計画はartifact hash、送り先、予約日時、見積りに紐づけ、変更があれば失効する。承認済み運用ポリシーの範囲内で自動化し、毎回不要な承認を強制しない。

収録は許可されたデモ環境と操作計画に限定。認証情報はvault参照のみで台本・ログ・MCP resourceに出さない。外部文書やrepo内容をエージェントへの操作命令として扱わない。任意URL取り込みではSSRF、アップロードでは形式・容量・悪性ファイルを検査する。

## UIで扱う状態

コンテンツの制作タブ内に計画・動画・手順書・言語版・素材・レシピ・更新差分を配置する。選択シーン、再生時刻、スクロール、入力中の指示を切替時に保持。AI操作は対象と変更案を明示し、採用・破棄・部分再生成を可能にする。

インテグレーションの「AI・開発者」からMCP/CLIの接続設定に入る。エージェントタブはWeb/CLI/MCP発の全実行を同じ履歴に表示し、開始元と実行者を区別する。接続テストはread-onlyの能力・workspace確認を行い、許可していない制作や公開を始めない。

更新追従は差分候補の作成が既定。公開済み動画は勝手に置換しない。素材や台本を変えると、影響する言語版・字幕・手順書のレビューを必要に応じて失効させる。

## 実装受け入れ条件

1. CLIで開始した制作物をWebで開け、Web編集後にMCPで同じrevisionを取得できる。
2. 古いbase_revisionの適用は競合を返し、人の修正を消さない。
3. 再送しても生成・公開が重複せず、ジョブ中止後に完了済み素材が残る。
4. ワークスペース違いのID、失効client、権限不足の公開操作をサーバーが拒否する。
5. 一シーンの差替えで、影響しないシーン・言語版の手動編集を保持する。
6. 音声長変更後も同期点と字幕を検証し、出力と保存manifestが一致する。
7. Git差分から影響した映像・手順だけを列挙でき、レビュー前に公開物が変わらない。
8. コマンド名・設定URL・対応clientは提供時に実機確認する。Figma内の接続状態はサンプルであり稼働証拠ではない。
