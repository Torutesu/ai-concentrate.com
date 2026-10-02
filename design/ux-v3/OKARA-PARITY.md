# Okara 公開機能との対応要件

調査日：2026-10-02。公式サイト・公式ドキュメントに記載された機能が対象。ログイン後の実動作・非公開機能・API制約を検証したものではない。「掲載あり」は提供実態の独立検証ではない。Concentrateは全項目を要件対象とし、未実装のまま対応済みとしない。

**現在の実装状況：以下はすべて未実装。Figmaの画面設計・仕様定義の段階。**

| ID | 機能要件・受け入れ条件 | Concentrateの設計先 | 根拠 |
|---|---|---|---|
| C01 | サイトを解析し製品情報・顧客・価値・競合を抽出。利用者が訂正できる | オンボ / 製品コンテキスト | [Quickstart](https://okara.ai/docs/quickstart) |
| C02 | 製品概要、30日戦略、競合分析、ブランドボイス、コンテンツ方針を編集・版管理し全エージェントへ渡す | 戦略 | [Company](https://okara.ai/docs/dashboard/company)、[公式サイト](https://okara.ai/) |
| C03 | 再解析で資料変更を検出し戦略を更新。手動編集を保持して比較できる | 製品コンテキスト | [Website Refresh](https://okara.ai/docs/features/website-refresh) |
| C04 | 複数製品のデータ・戦略・接続・分析を分離し切替 | ワークスペース | [Multiple Projects](https://okara.ai/docs/features/multi-project) |
| C05 | メンバー招待、閲覧共有、アクセス取消。役割に応じて管理操作を制限 | 設定 | [Team Sharing](https://okara.ai/docs/features/team-sharing) |
| C06 | UI・AI応答・新規コンテンツの多言語。UI言語と制作言語を独立 | 日本語/English設定・市場別原稿 | [Localization](https://okara.ai/docs/features/localization) |
| C07 | 日次の実行、機会・下書きのフィード、実行ログ、停止/再開 | 今日 / エージェント / 自動実行 | [Terminal](https://okara.ai/docs/dashboard/terminal)、[Introduction](https://okara.ai/docs/introduction) |
| C08 | 製品と戦略の文脈を使う相談、日次要約、提案から成果物へ移動 | AIに相談 | [Quickstart](https://okara.ai/docs/quickstart) |
| C09 | SEO監査、キーワード不足、オンページ修正、記事・LP提案 | 分析 / SEO / Writer | [SEO Agent](https://okara.ai/agent/seo) |
| C10 | SEO健全性、Core Web Vitals、メタ情報、技術エラー、被リンク・参照ドメイン | 分析 | [Analytics](https://okara.ai/docs/dashboard/analytics/overview) |
| C11 | AI検索の言及、感情、競合シェア、推移、具体的改善スニペット | GEO / 分析 | [GEO Agent](https://okara.ai/agent/geo) |
| C12 | GA4/GSCのセッション・クリック・表示・ページ別実績を取得。期間/データ取得日時を表示 | 分析 / 連携 | [Analytics](https://okara.ai/docs/dashboard/analytics/overview) |
| C13 | ブランドボイスに沿う記事・長文・LP。SEO構成と編集後CMS公開 | 原液エディタ / Writer / CMS連携 | [Introduction](https://okara.ai/docs/introduction) |
| C14 | Xの日次投稿・スレッド、部分再生成、文体調整、承認後の即時/予約投稿 | コンテンツ / カレンダー | [X Agent](https://okara.ai/agent/twitter) |
| C15 | LinkedInの日次投稿・記事、文体調整、個人/企業アカウントへの即時/予約投稿 | コンテンツ / カレンダー | [LinkedIn Agent](https://okara.ai/agent/linkedin) |
| C16 | Redditのキーワード監視、関連スレッド発見、返信/投稿案、投稿先ルールの確認 | コミュニティ | [Reddit Agent](https://okara.ai/agent/reddit) |
| C17 | Show HNの複数案と技術的説明を作りレビュー後に手動投稿 | コミュニティ / Hacker News | [Introduction](https://okara.ai/docs/introduction) |
| C18 | 会話からUGCブリーフ、指示編集、下書き保存、動画生成・プレビュー・MP4出力 | UGC動画 / 生成確認 | [UGC Video](https://okara.ai/agent/ugc-video) |
| C19 | 6比率(9:16,16:9,1:1,4:3,3:4,21:9)、解像度、尺、音声設定。生成前見積りとジョブ状態 | UGC動画 / 生成確認 / 利用量 | [UGC Video](https://okara.ai/agent/ugc-video) |
| C20 | 監査結果からコード修正、差分・検証結果提示、GitHub PR。レビューしてマージ | Coding / PR確認 | [Coding Agent](https://okara.ai/agent/coding) |
| C21 | CMS上のSEO改善も対象。コード経由/ CMS経由を接続先に合わせて選ぶ | Coding / CMS連携 | [SEO Fixes](https://okara.ai/docs/features/seo-fixes) |
| C22 | クリエイターの発見・適合候補、予算・条件、連絡、依頼、納品管理、支払い | クリエイター施策 / 依頼確認 | [Influencer](https://okara.ai/agent/influencer) |
| C23 | WordPress / Webflow / Framer / Wix / Sanityに画像・カテゴリ・フィールド対応で公開 | 連携 / 公開確認 | [公式サイト](https://okara.ai/) |
| C24 | WhatsApp / Telegramで相談・下書き・レポート | 連携 / AIに相談 | [公式サイト](https://okara.ai/) |
| C25 | 利用量・クレジット、見積り、実行ごとの消費、追加・上限・課金履歴 | 利用量・予算 | [Credits](https://okara.ai/docs/credits) |
| C26 | Humanizer、メタ説明生成、メタタグ検査、robots.txt、sitemap.xml、llms.txt、構造化データ、UTM、X動画取得 | マーケティングツール | [公式ツール一覧](https://okara.ai/) |
| C27 | プロンプト/スキル/ローンチの参照ライブラリ、イベントに合わせた計画 | ツール / 戦略。カタログ詳細は追加設計 | [公式サイト](https://okara.ai/) |

## 提供済み扱いにしない項目

- TikTok・Instagramの直接配信とSlack連携は、調査時点の[公式サイト](https://okara.ai/)でSoon表記。Concentrateの追加要件にも含めるが、Okara現行機能と区別する。
- クリエイター施策は[Influencer](https://okara.ai/agent/influencer)でXをLIVE、Instagram・YouTube・TikTokをSOONと記載。Concentrateは対象媒体ごとに提供状態を表示する。
- 戦略文書数はホームが5種、Company docsが4種の表現。Concentrateは製品情報＋4戦略文書を要件化。
- GEO対象はページによりGoogle AI/Gemini等の表現が異なる。Concentrateではエンジン別に取得方法・取得日時・クエリ集合を記録し、比較不能な数値を同一スコアに混ぜない。
- LPの「10+」は公開列挙の10分野として追跡。未公開の機能まで同等性を保証しない。契約価格や成果の数値は要件に流用しない。

## Concentrate固有の追加要件

URL以外にMD・選択リポジトリを製品理解の入力にする。根拠と仮説を分離。人間の具体シーン・独自見解を原液に残し、各媒体へ展開。参照改訂時に差分を提示し手動編集を保護。マスコット・城・実機画面を素材として横断利用。日本語UIから英語圏向け制作を行う。

## 実装の完了判定

各C-IDに、画面ノード・API/DB・外部プロバイダ・テスト・実行証拠を紐付ける。実アカウントでの投稿・入出金を行う前に、接続先と内容・予算がレビュー可能であること。外部APIの利用条件、権限、提供可否、費用は実装時点で再検証。機能カードが存在するだけでは合格にしない。

Figmaは全領域の入口と主要フローを設計。分析の各詳細タブ、CMS別マッピング、決済・納品例、テンプレートカタログの全状態は、実装に合わせてさらに詳細化が必要。
