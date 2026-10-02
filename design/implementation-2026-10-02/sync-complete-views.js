await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('20:391'));
await Promise.all(['Regular','Medium','Bold'].map(style=>figma.loadFontAsync({family:'Noto Sans JP',style})));
const page=figma.currentPage, created=[], mutated=[], screens={};
const vars=Object.fromEntries((await figma.variables.getLocalVariablesAsync()).map(v=>[v.name,v]));
const styles=Object.fromEntries((await figma.getLocalTextStylesAsync()).map(v=>[v.name.split('/').pop(),v]));
const base=await figma.getNodeByIdAsync('89:9427'),secondary=await figma.getNodeByIdAsync('20:401'),input=await figma.getNodeByIdAsync('92:8637'),area=await figma.getNodeByIdAsync('92:8641');
const startY=Math.max(...page.children.map(n=>n.y+n.height))+160;
function paint(key){return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:1,g:1,b:1}},'color',vars['glass/'+key]);}
function text(p,s,style='Small',w=1064){const n=figma.createText();p.appendChild(n);n.fontName={family:'Noto Sans JP',style:'Regular'};n.characters=s;n.textStyleId=styles[style].id;n.textAutoResize='HEIGHT';n.resize(w,n.height);n.fills=[paint('ink')];created.push(n.id);return n;}
function box(p,name,w=1152,dir='VERTICAL'){const n=figma.createAutoLayout(dir);p.appendChild(n);n.name=name;n.resize(w,1);n.primaryAxisSizingMode=dir==='VERTICAL'?'AUTO':'FIXED';n.counterAxisSizingMode=dir==='VERTICAL'?'FIXED':'AUTO';n.itemSpacing=16;n.fills=[];created.push(n.id);return n;}
function card(p,name){const n=box(p,name);n.paddingTop=n.paddingBottom=n.paddingLeft=n.paddingRight=22;n.fills=[paint('white')];n.cornerRadius=16;return n;}
function button(p,label){const n=secondary.createInstance();p.appendChild(n);n.setProperties({'Label#20:1':label});created.push(n.id);return n;}
function field(p,label,value,multi=false){const n=(multi?area:input).createInstance();p.appendChild(n);n.resize(1064,n.height);n.setProperties({'Label#5:32':label,'Value#5:33':value||' '});created.push(n.id);return n;}
function shell(key,title){const name='Implemented / '+title;let f=page.children.find(n=>n.name===name);if(!f){f=base.clone();page.appendChild(f);f.name=name;f.x=300+(Object.keys(screens).length%3)*1540;f.y=startY+Math.floor(Object.keys(screens).length/3)*1900;created.push(f.id);}else mutated.push(f.id);const m=f.children.find(n=>n.name==='Main');for(const c of [...m.children])c.remove();text(m,'ShogunAI / '+title,'Small');text(m,title,'Title');const body=box(m,'Content');screens[key]=f;return {f,m,body};}
function finish(s){s.f.resize(1440,Math.max(1020,s.m.height+48));}
for(const [key,title,label,body] of [
 ['x','コンテンツ / X','X投稿','月曜の朝、金曜の判断を探していませんか。'],
 ['article','コンテンツ / 記事','記事','仕事を再開するときに必要なのは、前回の判断とその背景です。'],
 ['reddit','コンテンツ / Reddit','Reddit draft','How do you recover the context of a project after a break?'],
 ['guide','コンテンツ / 手順書','手順 1','前回の判断と残っている論点を確認します。']
]){const s=shell(key,title);text(s.body,'企画　 原稿　 X　 記事　 Reddit　 動画　 手順書　 言語版　 素材　 更新　 変更案');text(s.body,'月曜の仕事復帰 / v3 · 保存済み','Heading');const actions=box(s.body,'Export actions',1152,'HORIZONTAL');button(actions,'Markdown');button(actions,'JSONを保存');button(actions,'保存する');const c=card(s.body,'Channel editor');field(c,'読み込み済みの企画名を検索','');field(c,'タイトル',label);field(c,'本文',body,true);button(c,'編集をロック');field(c,'AIへの指示','',true);button(c,'変更案を生成');text(c,'AI生成はサーバー設定待ちです。');finish(s);}
let s=shell('plan','コンテンツ / 企画');const c=card(s.body,'Brief');for(const [label,value] of [['対象','複数案件を持つフリーランス'],['伝えたいこと','前回の判断から仕事を再開する'],['CTA','ShogunAIを試す'],['顧客の課題','前回の判断を探し直す'],['施策の仮説','実演から体験利用につながるか'],['誘導先','https://shogunaios.com/ja'],['評価指標','初回の価値体験'],['評価日','未設定']])field(c,label,value);button(c,'保存する');finish(s);
s=shell('locales','コンテンツ / 言語版');let a=card(s.body,'Locales');text(a,'言語版','Heading');button(a,'日本語　7 項目');button(a,'English　0 項目');text(a,'独立した言語版','Heading');text(a,'制作言語を切り替えて項目を追加し、翻訳を入力・生成できます。UIの表示言語は変更しません。');finish(s);
s=shell('assets','コンテンツ / 素材');a=card(s.body,'Assets');text(a,'制作素材','Heading');text(a,'素材のクラウド保存・収録・動画書き出しは未接続です。');text(a,'プレビューは既存のShogunAI参考画像です。実収録ではありません。');button(a,'動画');finish(s);
s=shell('review','コンテンツ / 変更案');a=card(s.body,'No proposals');text(a,'変更案はまだありません','Heading');text(a,'保存した原稿やシーンから変更案を生成できます。');finish(s);
s=shell('reviewProposal','State / 変更案あり');a=card(s.body,'Review proposal');text(a,'変更内容を確認','Heading');field(a,'現在','元の原稿',true);field(a,'変更案','生成後の原稿 · 検証用の表示例',true);button(a,'変更を適用');finish(s);
s=shell('reviewStale','State / 変更案の競合');a=card(s.body,'Stale proposal');text(a,'この変更案の元の版は古くなっています。','Heading');field(a,'変更案','未適用の変更案',true);button(a,'変更を適用（無効）');finish(s);
s=shell('empty','State / 初回企画');a=card(s.body,'Empty production');text(a,'最初の企画を作る','Heading');button(a,'新しい企画');button(a,'ShogunAI サンプルを読み込む');finish(s);
s=shell('onboarding','State / ワークスペース作成');a=card(s.body,'Create workspace');text(a,'ワークスペースを作成','Heading');field(a,'製品・ブランド名','ShogunAI');button(a,'作成');finish(s);
s=shell('loading','State / 読込中');a=card(s.body,'Loading');text(a,'ワークスペースを読み込み中…','Heading');for(let i=0;i<2;i++){const n=box(a,'Skeleton',1064);n.resize(1064,70);n.primaryAxisSizingMode='FIXED';n.fills=[paint('mint')];}finish(s);
s=shell('error','State / 通信エラー');a=card(s.body,'Error');text(a,'操作を完了できませんでした。','Heading');button(a,'再読み込み');finish(s);
s=shell('locked','State / ロック解除の保存待ち');a=card(s.body,'Locked text');field(a,'本文','ロックした本文',true);button(a,'編集をロック');text(a,'ロック解除を保存すると本文を編集できます。');button(a,'保存する');finish(s);
s=shell('pagination','State / 一覧の追加読込');a=card(s.body,'Pagination');text(a,'20件を読み込み済み。以前の企画とそのカレンダー予定は未表示です。');button(a,'さらに読み込む');finish(s);
s=shell('restore','State / 復元確認');a=card(s.body,'Restore dialog');text(a,'v2を復元しますか？','Heading');text(a,'新しい版として保存します。現在の編集履歴も残ります。');button(a,'キャンセル');button(a,'復元する');finish(s);
s=shell('signin','State / ログイン');s.f.children.find(n=>n.type==='INSTANCE').visible=false;a=card(s.body,'Sign in');text(a,'AI Concentrate','Title');text(a,'ワークスペースにログイン');button(a,'ChatGPTで続ける');text(a,'製品の情報と制作物は、ワークスペースごとに保存されます。');finish(s);
// Existing content and video IDs remain stable. Add export controls once.
for(const id of ['89:9427','89:9548']){const f=await figma.getNodeByIdAsync(id);const m=f.children.find(n=>n.name==='Main');if(!m.children.some(n=>n.name==='Export actions')){const row=box(m,'Export actions',1152,'HORIZONTAL');button(row,'Markdown');button(row,'JSONを保存');mutated.push(f.id,m.id);f.resize(1440,Math.max(1020,m.height+48));}}
return {screenIds:Object.fromEntries(Object.entries(screens).map(([k,f])=>[k,f.id])),createdNodeIds:created,mutatedNodeIds:mutated,counts:{screens:Object.keys(screens).length,text:Object.values(screens).reduce((n,f)=>n+f.findAllWithCriteria({types:['TEXT']}).length,0),instances:Object.values(screens).reduce((n,f)=>n+f.findAllWithCriteria({types:['INSTANCE']}).length,0)}};
