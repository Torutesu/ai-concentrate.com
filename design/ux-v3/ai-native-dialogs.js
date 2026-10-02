// Authoring record. Prepend interaction-helpers.js.
let i=0;const overlayIds=[];function dialog(key,title,copy){const n=panel(page,'AI native / '+title,560,16,24);n.x=19000+(i%5)*640;n.y=4900+Math.floor(i++/5)*780;states[key]=n.id;overlayIds.push(n.id);const h=between(row(n,'Dialog header',512));text(h,title,'Card title','ink',440);button(h,'閉じる','__close');if(copy)text(n,copy,'Small','muted',512);return n;}
const manual=dialog('captureManual','画面を収録','ブラウザの画面共有で対象ウィンドウを選択します。');field(manual,'収録対象','デモ用ウィンドウ',512);field(manual,'音声','マイクなし / 収録後に音声を生成',512);text(manual,'通知と個人情報を隠してから開始','Small');button(manual,'画面共有を開始','captureCountdown',true);
const countdown=dialog('captureCountdown','収録を開始します','開始前に画面共有の許可が必要です。');text(countdown,'3 → 2 → 1','Heading');button(countdown,'収録を停止して取り込む','run',true);button(countdown,'キャンセル','capture');
const ready=dialog('captureReady','接続の確認','デモ環境のログインと収録可能な範囲を確認する状態。');badge(ready,'確認結果のサンプル');text(ready,'対象：ShogunAIデモ環境\n画面：日本語\n除外：メール・氏名・通知','Body','ink',512);button(ready,'収録設定に戻る','capture',true);
const asset=dialog('assetDetails','素材の詳細','demo-session.mov');field(asset,'使用中','シーン02・03 / 手順2',512);field(asset,'来歴','デモ収録 / 製品情報 v3',512);text(asset,'マスク：個人情報 / 利用権：自社','Small');button(asset,'使用箇所を開く','video',true);
const upload=dialog('upload','素材をアップロード','動画・画像・音声・PPTX・PDFを追加');field(upload,'ファイル','ファイルを選択 / ドロップ',512);text(upload,'上限と対応形式は選択時に確認','Caption','muted');button(upload,'追加して解析','run',true);
const media=dialog('mediaPrompt','AIで素材を作る','映像・画像・モーションを制作物の一部として追加');field(media,'作る素材','ロゴがゆっくり現れる、3秒のモーション',512);field(media,'ブランド','ShogunAI / 制作レシピ v2',512);field(media,'追加先','シーン04 / 新しいレイヤー',512);button(media,'見積りと生成内容を確認','generationConfirm',true);
const cost=dialog('generationConfirm','生成内容の確認','対象・見積り・変更する範囲を確認して開始');field(cost,'対象','シーン04 / モーション1点',512);field(cost,'見積り','実行サービスから取得して表示',512);text(cost,'確定金額が上限を超える場合は開始しない','Caption','muted');button(cost,'この内容で生成','run',true);
const consent=dialog('connectConsent','AIクライアントへの接続許可','対象のワークスペースと操作範囲を選択');field(consent,'クライアント','Codex',512);field(consent,'対象','ShogunAIのみ',512);text(consent,'☑ 文脈と制作物の読み取り\n☑ 下書きの作成・編集\n☑ 収録・書き出し\n☐ 公開・予約\n☐ メンバー・請求の管理','Body','ink',512);button(consent,'この範囲で接続','connectionTest',true);
const test=dialog('connectionTest','接続テスト','テストは読み取りだけを行います。');badge(test,'成功時の表示例');text(test,'認証 ✓\nShogunAIへのアクセス ✓\n下書き編集の権限 ✓\n公開権限：なし','Body','ink',512);button(test,'接続一覧へ','mcp',true);
const capabilities=dialog('capabilities','操作とデータ','Web・CLI・MCPは共通の操作契約を使用');text(capabilities,'取得：文脈・制作物・素材・レシピ\n制作：計画・収録・音声・同期・翻訳\n編集：シーンの部分変更・差分適用\n運用：レビュー・書き出し・実行の中止\n公開：別の権限と承認済み計画が必要','Body','ink',512);button(capabilities,'実行履歴を見る','run');
const revoke=dialog('revokeClient','アクセスを取り消す','Codexのこの接続から、新しい操作ができなくなります。制作物は残ります。');text(revoke,'実行中の処理はジョブ一覧で確認できます。','Small','ink',512);button(revoke,'取り消す','revoked',true);
const revoked=dialog('revoked','アクセスを取り消しました','再接続には認証が必要です。');button(revoked,'再接続する','connectConsent');
const cancel=dialog('cancelJob','実行を中止','完了済みの素材は残ります。処理済みの利用量は計上されます。');button(cancel,'中止する','cancelled',true);button(cancel,'実行を続ける','run');
const cancelled=dialog('cancelled','実行を中止しました','制作計画と完了したシーンを保存しました。');button(cancelled,'完了分を編集','video',true);button(cancelled,'残りを再開','run');
const log=dialog('jobLog','実行ログ','job_01 / CLI / Toru');text(log,'10:42:00  文脈 v3 を取得\n10:42:02  制作計画を確定\n10:42:04  デモ環境へ接続\n10:42:05  シーン02を収録中','Small','ink',512);button(log,'実行履歴に戻る','run');
const applied=dialog('applied','変更を適用しました','シーン02の新しい版を作成しました。');button(applied,'動画に戻る','video',true);button(applied,'履歴を見る','versionPreview');
const comment=dialog('commentSaved','コメントを保存しました','シーン02 / 00:08.4 に紐づけました。');button(comment,'レビューに戻る','review');
const version=dialog('versionPreview','v2を確認','現在の版はv3です。復元すると新しい版を作成します。');field(version,'v2の内容','MCPから生成 / シーン4件',512);button(version,'この版から新しい版を作る','applied',true);
const exporting=dialog('exporting','書き出し中','v3からプレビューを作成しています。制作物の編集は続けられます。');badge(exporting,'レンダリング');button(exporting,'編集を続ける','video',true);button(exporting,'出力結果を見る','exported');button(exporting,'中止する','cancelJob');
const exported=dialog('exported','出力結果','出力完了時の表示例');text(exported,'動画 / MP4\n字幕 / SRT・VTT\n手順書 / Markdown・HTML\n制作manifest / v3','Body','ink',512);button(exported,'公開前レビューへ','review');
const rr=dialog('reviewRequested','レビューを依頼','依頼先と対象の版を確認');field(rr,'依頼先','ワークスペースのレビュー担当者',512);field(rr,'対象','日本語版 / v3',512);button(rr,'この版をレビュー対象にする','review',true);
const blocked=dialog('publishBlocked','公開前レビューが必要です','v3のレビューを完了してから、公開先と予約時刻を設定してください。');button(blocked,'レビューへ','review',true);
const recipe=dialog('recipeSaved','制作レシピを保存','構成・スタイル・音・差し替え箇所を新しいレシピとして保存する状態。');button(recipe,'レシピを開く','recipes');
const playback=dialog('playback','プレビュー','Figmaでは映像・音声の再生は未実装です。編集レイアウトと操作動線を確認できます。');button(playback,'動画に戻る','video',true);
const fail=dialog('jobFailed','一部の生成に失敗しました','シーン02の音声生成が失敗しました。ほかのシーンは保存されています。');button(fail,'失敗分だけ再試行','run',true);button(fail,'完了分を編集','video');
const conflict=dialog('revisionConflict','新しい編集があります','作業中にToruが台本を更新しました。古い変更案をそのまま適用できません。');button(conflict,'最新版と比較','review',true);button(conflict,'変更案を破棄','video');
return {...result(),overlayIds};
