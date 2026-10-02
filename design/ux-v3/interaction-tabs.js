const home=await root('20:830','home','今日');
badge(home.head,'10月2日（金）');
const [hq,hd]=split(home.body,352,780);
text(hq,'確認待ち  3','Card title');
for(const [title,sub]of [['月曜の仕事復帰','Xの原稿 · 承認待ち'],['英語版の見出し','LinkedIn · 編集待ち'],['製品情報の更新','1件の差分']]){const c=panel(hq,title,312,6,12);text(c,title,'Label');text(c,sub,'Caption','muted');target(c,title==='製品情報の更新'?'contextDiff':'home');}
rule(hq,312);text(hq,'実行中','Label');text(hq,'SEO監査 · 8 / 12ページ','Small');button(hq,'実行状況を見る','agentRunning');
text(hd,'月曜の仕事復帰','Heading');badge(hd,'X · 日本語 · 下書き');
field(hd,'投稿先','ShogunAI / 接続先を選択',740);
field(hd,'本文','月曜の朝、最初の仕事が「先週の仕事を思い出すこと」になっていませんか。\n\n何を決めて、なぜそう決めて、何が残ったのか。仕事の続きは、その文脈から。',740);
field(hd,'公開日時','2026/10/05  09:00 · Asia/Tokyo',740);
note(hd,'接続が必要です','原稿を残したまま、公開先アカウントを接続できます。',740);
const ha=row(hd,'Review actions',740);button(ha,'接続して予約','homeConnect',true);button(ha,'修正を保存','homeSaved');

const strategy=await root('20:722','strategy','戦略');badge(strategy.head,'v1 · 保存済み');
const [sl,sr]=split(strategy.body,320,812);text(sl,'30日プラン','Heading');field(sl,'目標','体験登録を増やす',280);field(sl,'対象','創業者 / PM / フリーランス',280);field(sl,'市場・言語','日本・北米 / 日本語・English',280);field(sl,'制作時間','週5時間',280);button(sl,'変更を反映','strategySaved',true);
text(sr,'優先する施策','Card title');
for(const [title,body]of [['01  仕事を再開する瞬間','X + ショート動画 / 週2本\n検証：登録率と翌週の再利用率'],['02  背景説明の繰り返し','記事 + LinkedIn / 週1本\n検証：記事経由の体験登録'],['03  顧客の言葉を集める','インタビュー / 隔週\n検証：実例と表現の妥当性']]){const c=panel(sr,title,772,8,14);text(c,title,'Label');text(c,body,'Small','muted',744);}
const sa=row(sr,'Plan actions',772);button(sa,'AIに調整を頼む','strategyAI');button(sa,'原液の案を作る','strategyGenerated',true);text(sr,'根拠：製品理解 v1・目標設定　/　成果は検証前','Caption','muted');

const content=await root('22:767','content','コンテンツ');button(content.head,'新しい企画','contentNew',true);
const [cl,ce]=split(content.body,292,840);field(cl,'検索','タイトル・本文を検索',252);tabs(cl,[['すべて',null,true],['下書き',null]],252);
for(const [title,meta]of [['月曜の仕事復帰','原液 v2 · 2媒体'],['背景説明、何回した？','原液 · 編集中'],['会議5分前','ショート動画 · 制作中'],['昨日を覚える家臣','マスコット · 企画']]){const c=panel(cl,title,252,6,12);if(title==='月曜の仕事復帰')c.fills=[paint('mint')];text(c,title,'Label');text(c,meta,'Caption','muted');target(c,title==='会議5分前'?'contentVideo':'content');}
tabs(ce,[['原液','content',true],['X','contentX'],['記事','contentArticle'],['動画','contentVideo']],800);
const ch=between(row(ce,'Document title',800));text(ch,'月曜の仕事復帰','Card title');button(ch,'日本語 ▾','contentLocale');
text(ce,'月曜の朝、金曜の自分に聞けたら。','Heading','ink',800);
text(ce,'月曜の朝、最初にやる仕事が「先週の仕事を思い出すこと」になっていないだろうか。\n\n必要なのは、全部の履歴を読み直すことではない。何を決めて、なぜそう決めて、何が残ったのか。そのつながりだ。\n\nShogunAIが掲げるのは、仕事の記憶を必要な文脈として呼び出し、次の作業へつなげる体験。','Body','ink',800);
field(ce,'具体シーン','金曜に中断した案件を開き、前回の判断を確認する。',800);
const ca=between(row(ce,'Editor actions',800));text(ca,'保存済み · 10:42','Caption','muted');const cb=row(ca,'Editing',460);button(cb,'選択箇所をAIで編集','contentCompare');button(cb,'媒体へ展開','contentGenerating',true);

const agents=await root('22:631','agents','エージェント');badge(agents.head,'実行中 1');const [al,ar]=split(agents.body,268,864);
for(const a of ['SEO','GEO','Writer','X / LinkedIn','Reddit / Hacker News','UGC動画','Coding','Influencer']){const r=panel(al,a,228,0,10);if(a==='SEO')r.fills=[paint('mint')];text(r,a,'Label');target(r,'agent'+a.split(/[ /]/)[0]);}
tabs(ar,[['設定','agents',true],['実行ログ','agentRunning'],['結果','agentResult']],824);
text(ar,'SEO監査','Heading');field(ar,'対象URL','https://shogunaios.com/ja',824);field(ar,'調べること','技術SEO・メタ情報・キーワード候補',824);const aa=row(ar,'Scope',824,20);field(aa,'範囲','12ページまで',402);field(aa,'頻度','手動実行',402);
note(ar,'公開・コード変更は行いません','監査結果と改善案を、このタブに表示します。',824);const ab=between(row(ar,'Run agent',824));text(ab,'見積りは実行前に確認','Caption','muted');button(ab,'実行内容を確認','agentConfirm',true);

const context=await root('22:526','context','製品コンテキスト');button(context.head,'情報を追加','contextAdd',true);const [xl,xr]=split(context.body,340,792);text(xl,'情報ソース','Card title');
for(const [name,status]of [['公式サイト','8ページ · 最新'],['product-brief.md','更新あり · 差分を確認'],['GitHub / docs','main · 読み取り専用']]){const r=panel(xl,name,300,6,12);text(r,name,'Label');text(r,status,'Caption','muted');target(r,status.includes('差分')?'contextDiff':'context');}button(xl,'再読み込み','contextLoading');
text(xr,'製品の理解','Heading');field(xr,'製品名','ShogunAI',752);field(xr,'伝えたい価値','仕事の記憶・文脈の呼び出し・次の作業の実行',752);field(xr,'主な利用者','創業者・PM・複数案件を持つフリーランス',752);badge(xr,'AIの仮説 · 要確認');text(xr,'料金・対応連携・定量的な効果は未確認。','Small','muted',752);const xa=between(row(xr,'Save understanding',752));text(xa,'参照：公式サイト / 2026.10.02','Caption','muted');button(xa,'変更を保存','contextSaved',true);

const analytics=await root('22:1197','analytics','分析');button(analytics.head,'期間：過去30日 ▾','analyticsRange');tabs(analytics.body,[['成果','analytics',true],['SEO','analyticsSEO'],['GEO','analyticsGEO']],1152);
const stats=row(analytics.body,'Metrics',1152,16);for(const title of ['登録数','検索クリック','公開したコンテンツ']){const c=panel(stats,title,373,10);text(c,title,'Label');text(c,'—','Display');text(c,'計測データ未取得','Caption','muted');}
const ap=panel(analytics.body,'Metric connection',1152,20,28);text(ap,'成果を計測する','Heading');text(ap,'GA4とSearch Consoleを接続し、このワークスペースの成果を確認します。','Body','muted',1096);field(ap,'GA4プロパティ','未選択',1096);const ac=row(ap,'Analytics actions',1096);button(ac,'GA4を接続','analyticsConnect',true);button(ac,'Search Consoleを接続','analyticsSearch');text(ap,'データがない期間は「0」ではなく「未取得」と表示します。','Caption','muted');

const integrations=await root('22:1305','integrations','連携');const [il,ir]=split(integrations.body,340,792);field(il,'連携サービスを検索','名前で検索',300);
for(const [name,status,to]of [['X','未接続','integrations'],['LinkedIn','未接続','integrationLinkedIn'],['WordPress / CMS','未接続','integrationCMS'],['GA4 / Search Console','未接続','integrationAnalytics'],['GitHub','読み取り接続済み','integrationGithub'],['YouTube / Instagram / TikTok','書き出し・手動公開','integrationVideo'],['通知・その他','未接続','integrationNotifications']]){const r=panel(il,name,300,4,10);text(r,name,'Label');text(r,status,'Caption','muted');target(r,to);}
text(ir,'X','Heading');badge(ir,'未接続');text(ir,'原稿の作成・投稿・予約','Body');field(ir,'接続するワークスペース','ShogunAI',752);note(ir,'接続後にアカウントを確認','接続だけでは投稿しません。予約・公開する内容は実行前に確認できます。',752);text(ir,'利用する権限','Label');text(ir,'アカウントの確認 / 投稿の読み取り・作成\n接続維持に必要な認可','Small','muted',752);button(ir,'Xを接続','integrationConsent',true);rule(ir,752);text(ir,'接続履歴','Label');text(ir,'まだ接続されていません。','Small','muted');
return result();
