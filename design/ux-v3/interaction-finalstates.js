const overlays=[];let di=24;
function dialog(key,title){const n=panel(page,'Overlay / '+title,560,16,24);n.x=8000+(di%4)*640;n.y=80+Math.floor(di++/4)*760;states[key]=n.id;overlays.push(n.id);const h=between(row(n,'Dialog heading',512));text(h,title,'Heading');button(h,'閉じる','__close');return n;}
function actions(p,label,to){const r=row(p,'Dialog actions',512);button(r,label,to,true);button(r,'キャンセル','__close');}
for(const [key,title,body,cta,to]of [
 ['agentConfirm','監査を実行','対象：ShogunAI / 12ページ\nサイトへの変更なし\n利用量：見積りを取得してから確定','実行を確定','agentRunning'],
 ['videoConfirm','動画の生成を確認','9:16 / 30秒 / 日本語音声\n実機素材を使用\n利用量：見積り取得後に確定','生成を開始','videoRendering'],
 ['codeConfirm','PRの作成を確認','選択したリポジトリ / 新しいブランチ\n差分と検証結果を添付\nマージ・公開は実行しません','PRを作成','codeCreated'],
 ['agentStop','実行を停止しますか？','完了済みの結果は残ります。開始済みの外部処理はすぐに停止できない場合があります。','停止する','agentStopped'],
 ['videoExport','動画を書き出す','MP4・投稿文・サムネイル\n9:16 / 30秒 / 日本語','書き出す','exportReady'],
 ['notificationConnect','通知先を接続','サービス：Telegram\n接続先チャットを確認して、承認待ち・失敗通知を有効にします。','接続先を確認','notificationConfirmed'],
 ['communityDestination','投稿先の確認','コミュニティのルール・宣伝可否を確認します。本文はコピーし、投稿先で最終確認して公開してください。','本文をコピー','agentCopied'],
 ['geoSetup','GEO調査を設定','質問：仕事の文脈を覚えるAIは？\n言語：日本語\n対象モデル・質問・実行日時を保存','調査を開始','analyticsLoading'],
 ['analyticsConnectionInfo','計測の接続','GA4 / ShogunAI（デモ）\n読み取り専用 / 初回同期中\nまだ表示できるデータはありません。','再接続','analyticsConnect']
]){const d=dialog(key,title);text(d,body,'Body','ink',512);actions(d,cta,to);}
const video=dialog('videoRendering','動画を生成中');text(video,'待機中 → 素材を処理 → 映像を生成 → 書き出し','Small','muted',512);badge(video,'素材を処理しています');text(video,'このパネルを閉じても生成は続きます。','Body','ink',512);button(video,'完了した動画を確認','videoReady');button(video,'中止','agentStop');
const ready=dialog('videoReady','動画の生成が完了');badge(ready,'MP4 · 9:16 · 30秒');text(ready,'映像・音声・字幕を確認してから公開できます。','Body','ink',512);button(ready,'書き出し','videoExport',true);button(ready,'台本を修正','contentVideo');
const ai=dialog('assistant','AIに相談');badge(ai,'ShogunAI · 開いている作業を参照');text(ai,'何を手伝いましょうか？','Body');field(ai,'メッセージ','この原稿をもう少し短くしたい',512);button(ai,'変更案を作る','contentCompare',true);text(ai,'提案は確認してから適用します。','Caption','muted');
const candidates=dialog('creatorCandidates','候補と依頼条件');field(candidates,'候補','候補者を選択',512);field(candidates,'成果物','X投稿1本 / 実使用デモ',512);field(candidates,'予算・期限','金額を入力 / 納期を選択',512);text(candidates,'送信前に依頼内容・宛先・金額を確認します。','Small','muted',512);button(candidates,'依頼内容を確認','creatorConfirm',true);
const creator=dialog('creatorConfirm','依頼内容を確認');text(creator,'候補者・金額・納期の入力が必要です。','Body','danger',512);button(creator,'条件を入力する','creatorCandidates');
const toastDefs=[['homeSaved','下書きを保存しました'],['strategySaved','戦略を保存しました'],['contextSaved','製品の理解を更新しました'],['calendarSaved','下書きを保存しました'],['contentCopied','本文をコピーしました'],['agentCopied','本文をコピーしました'],['integrationConnectedCMS','CMS設定を保存しました'],['integrationChecking','接続を確認しました'],['codeCreated','PRを作成しました'],['exportReady','書き出しが完了しました'],['notificationConfirmed','通知先を接続しました'],['contentCMSSent','CMSに下書きを送信しました']];
const toasts=[];for(const [key,title]of toastDefs){const d=dialog(key,title);d.name='Toast / '+title;toasts.push(d.id);}
const partial=dialog('contentPartial','一部の原稿を作成しました');text(partial,'Xは保存済みです。記事と動画の作成は中止しました。','Body','ink',512);button(partial,'Xの原稿を編集','contentX',true);button(partial,'残りを再実行','contentGenerating');
const stop=dialog('agentStopped','停止しました');text(stop,'完了した8ページ分の結果は残っています。','Body','ink',512);button(stop,'結果を見る','agentResult',true);button(stop,'残りを再実行','agentRunning');
return {...result(),overlays,toasts};
