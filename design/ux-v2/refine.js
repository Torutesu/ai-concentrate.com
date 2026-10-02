await Promise.all(['Regular','Medium','Bold'].map(style=>figma.loadFontAsync({family:'Noto Sans JP',style})));
const buttons={};for(const [kind,id] of Object.entries({primary:'5:266',secondary:'5:269',accent:'5:272'})){const c=await figma.getNodeByIdAsync(id);buttons[kind]={c,key:Object.keys(c.componentPropertyDefinitions)[0]};}
const vars=await figma.variables.getLocalVariablesAsync();const tokens=Object.fromEntries(vars.filter(v=>v.variableCollectionId==='VariableCollectionId:5:167').map(v=>[v.name,v]));
const styles=await figma.getLocalTextStylesAsync();const ts=Object.fromEntries(styles.map(s=>[s.name.split('/').pop(),s]));
const page=await figma.getNodeByIdAsync('15:918');await figma.setCurrentPageAsync(page);
const colors={ink:'#182a24',muted:'#6f7a74',line:'#e2e7e3',green:'#173e30',lime:'#d6f887',surface:'#f6f8f5',white:'#ffffff',sidebar:'#142c23',subtle:'#f0f5e9',feature:'#1d402f',onDark:'#e5ece6',darkMuted:'#b3c4b9',input:'#fcfdfb'};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
function paint(k){const p={type:'SOLID',color:rgb(colors[k]||k)};return tokens['color/'+k]?figma.variables.setBoundVariableForPaint(p,'color',tokens['color/'+k]):p;}
function bind(n,k,v,group='spacing'){n[k]=v;if(tokens[group+'/'+v])n.setBoundVariable(k,tokens[group+'/'+v]);}
function box(p,name,w,dir='VERTICAL',bg=null,gap=0,pad=0){const n=figma.createAutoLayout(dir);n.name=name;p.appendChild(n);n.resize(w,1);n.primaryAxisSizingMode=dir==='VERTICAL'?'AUTO':'FIXED';n.counterAxisSizingMode=dir==='VERTICAL'?'FIXED':'AUTO';n.fills=bg?[paint(bg)]:[];bind(n,'itemSpacing',gap);for(const k of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])bind(n,k,pad);return n;}
function txt(p,s,style='Small',color='ink',w){const n=figma.createText();n.fontName={family:'Noto Sans JP',style:'Regular'};n.characters=s;n.name=s.slice(0,42);n.textStyleId=ts[style].id;n.fills=[paint(color)];p.appendChild(n);if(w){n.textAutoResize='HEIGHT';n.resize(w,n.height);}return n;}
function round(n,r=8){n.cornerRadius=r;for(const k of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])if(tokens['radius/'+r])n.setBoundVariable(k,tokens['radius/'+r]);return n;}
function stroke(n){n.strokes=[paint('line')];n.strokeWeight=1;return n;}
function row(p,name,w,gap=12,bg=null,pad=0){const n=box(p,name,w,'HORIZONTAL',bg,gap,pad);n.counterAxisAlignItems='CENTER';return n;}
function between(n){n.primaryAxisAlignItems='SPACE_BETWEEN';return n;}
function fixed(n,w,h){n.resize(w,h);n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';return n;}
function icon(p,name,size=20,color='ink'){const n=figma.createNodeFromSvg(SOURCE.icons[name].replaceAll('currentColor',colors[color]));p.appendChild(n);n.name='Icon/'+name;n.resize(size,size);return n;}
function btn(p,label,kind='secondary'){const a=buttons[kind],n=a.c.createInstance();p.appendChild(n);n.setProperties({[a.key]:label});return n;}
function chip(p,s,active=false){const n=round(row(p,'Status / '+s,100,0,active?'subtle':'surface',6),5);n.primaryAxisSizingMode='AUTO';txt(n,s,'Caption',active?'green':'ink');return n;}
const links=[],screens={},components={};
function nav(n,d){links.push([n,d]);return n;}
const changed=[];const get=id=>figma.getNodeByIdAsync(id);
async function go(n,id){await n.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:id,navigation:'NAVIGATE',transition:null}]}]);changed.push(n.id);}
const form=await get('15:1303');const parent=form.parent;const holder=box(parent,'Centered form area',1232,'VERTICAL','surface',0,32);holder.counterAxisAlignItems='CENTER';holder.appendChild(form);changed.push(form.id,parent.id);
// The library only simulates the first idea, without routing unrelated ideas to it.
for(const id of ['15:1028','15:1037','15:1038','15:1047','15:1048','15:1057','15:1058','15:1067']){const n=await get(id);await n.setReactionsAsync([]);changed.push(id);}
// Applied revision retains channel editing context.
const original=await get('15:1163');const updated=original.clone();page.appendChild(updated);updated.name='07 / 変更を適用済み';updated.x=4640;updated.y=80;screens.updated=updated;
const notice=updated.findOne(n=>n.name==='Source revision notice');for(const n of [...notice.children])n.remove();txt(notice,'✓ 原液 v2 の変更を適用しました','Label','green');
const current=updated.findOne(n=>n.type==='TEXT'&&n.characters.startsWith('月曜の朝、最初の仕事が\n'));const newer='月曜の朝、最初の仕事が\n「先週の仕事を思い出すこと」になっていませんか。\n\n金曜に止まった案件を開く。\n前回の決定を確かめて、次の一手へ。\n\n仕事の続きを始めるために、\n取り戻したいのは、その文脈。';current.characters=newer;
updated.findOne(n=>n.type==='TEXT'&&n.characters==='原液 v1  ·  手動編集あり').characters='原液 v2  ·  手動編集あり';
await go(await get('15:1385'),updated.id);
// Preview contains the actual whole draft; no silently missing final lines.
for(const frame of [original,updated]){const pv=frame.findOne(n=>n.name==='Publish preview');const t=pv.findOne(n=>n.type==='TEXT'&&n.characters.startsWith('月曜の朝、最初の仕事が'));t.characters=frame===updated?newer:'月曜の朝、最初の仕事が\n「先週の仕事を思い出すこと」になっていませんか。\n\n何を決めたか。なぜそう決めたか。残った論点は何か。\n\n仕事の続きを始めるために、取り戻したいのは、その文脈。';changed.push(t.id);}
// Video draft uses a real scene list, not one large free text field.
const video=original.clone();page.appendChild(video);video.name='08 / ショート動画';video.x=4640;video.y=1140;screens.video=video;
const channels=video.findOne(n=>n.name==='Channels');for(const c of channels.children){if(c.type==='FRAME'&&c.name.startsWith('Channel /')){const on=c.name==='Channel / ショート動画';c.fills=on?[paint('white')]:[];c.strokes=on?[paint('line')]:[];}}
const paper=video.findOne(n=>n.name==='Channel editor');for(const n of [...paper.children])n.remove();const head=between(row(paper,'Video heading',570));txt(head,'ショート動画','Heading');chip(head,'9:16 · 30秒');
const scenes=[['01  0–5秒','月曜の朝、また探してる。','複数のタブを行き来する手元。'],['02  5–12秒','何を決めて、なぜそう決めた？','前回の判断と残った論点を表示。'],['03  12–23秒','仕事の続きは、その文脈から。','ShogunAIで文脈を呼び出す実機デモ。'],['04  23–30秒','思い出す時間から、進める時間へ。','作業を再開。ロゴとサイトURL。']];
for(const [time,line,scene] of scenes){const s=round(stroke(box(paper,'Scene '+time,570,'VERTICAL','white',8,16)));txt(s,time,'Caption','green');txt(s,line,'Label');txt(s,scene,'Small','ink',538);}
const sf=between(row(paper,'Scene actions',570));btn(sf,'＋ シーンを追加');txt(sf,'原液 v2','Caption','muted');
const rail=video.findOne(n=>n.name==='Production context');for(const n of [...rail.children])n.remove();const media=round(stroke(box(rail,'Materials',300,'VERTICAL','white',16,20)));txt(media,'素材  1 / 3','Label');txt(media,'✓ ロゴ','Small');txt(media,'○ 手元の撮影','Small');txt(media,'○ 実機デモ','Small');btn(media,'素材を追加');const notes=round(stroke(box(rail,'Scene verification',300,'VERTICAL','white',12,20)));txt(notes,'要確認','Label');txt(notes,'シーン03の操作を実機で確認','Small','ink',260);const handButton=btn(notes,'制作待ちにする','primary');await go(handButton,'15:1387');
for(const frame of [original,updated])await go(frame.findOne(n=>n.name==='Channel / ショート動画'),video.id);await go(channels.findOne(n=>n.name==='Channel / X'),'15:1163');
// AI editing is scoped to the selected paragraph in the concentrate, never an X revision.
const ai=(await get('15:1325')).clone();page.appendChild(ai);ai.name='09 / 選択箇所をAIで編集';ai.x=6160;ai.y=80;screens.ai=ai;
ai.findOne(n=>n.type==='TEXT'&&n.characters==='変更を確認').characters='選択箇所を編集';ai.findOne(n=>n.type==='TEXT'&&n.characters==='X  /  原液 v1 → v2').characters='原液  /  段落 2';
const bef=ai.findOne(n=>n.name==='Current draft');const aft=ai.findOne(n=>n.name==='Suggested draft');for(const n of [...bef.children])n.remove();for(const n of [...aft.children])n.remove();txt(bef,'選択した本文','Label');txt(bef,'必要なのは、全部の履歴を読み直すことではない。何を決めて、なぜそう決めて、何が残ったのか。そのつながりだ。','Body','ink',524);txt(aft,'短くする','Label');const suggestion=round(box(aft,'Suggested paragraph',524,'VERTICAL','subtle',0,12));txt(suggestion,'思い出したいのは、決めたこと、その理由、残った論点。そのつながりだ。','Body','green',500);btn(aft,'別の案');
const decisions=ai.findOne(n=>n.name==='Diff decisions');for(const n of decisions.children){if(n.type==='INSTANCE')await go(n,'15:1069');}await go(await get('15:1125'),ai.id);
// Clear active navigation without relying only on colour.
for(const [fid,label] of [['15:1069','原液'],['15:1163','媒体別  2'],[updated.id,'媒体別  2'],[video.id,'媒体別  2']]){const f=await get(fid);const tabs=f.findOne(n=>n.name==='Project tabs');const t=tabs.findOne(n=>n.type==='TEXT'&&n.characters===label);t.textDecoration='UNDERLINE';changed.push(t.id);}
// Concise states live in the handoff canvas, not as explanatory UI panels.
const states=box(page,'UX states / component specifications',1440,'VERTICAL','white',24,32);states.x=1600;states.y=2500;txt(states,'操作の状態','Title');const sr=row(states,'State examples',1376,24);sr.counterAxisAlignItems='MIN';
for(const [name,title,message,action] of [['Empty','企画はまだありません','','＋ 新しい企画'],['Generating','原液を作成中…','キャンセルしても入力内容は残ります。','キャンセル'],['Generation failed','作成できませんでした','入力内容は保存されています。','もう一度試す'],['Save failed','未保存の変更があります','接続を確認して保存してください。','再保存']]){const n=round(stroke(box(sr,name,326,'VERTICAL','surface',16,20)));txt(n,title,'Label','ink',286);if(message)txt(n,message,'Small','ink',286);btn(n,action);}
const specs=txt(states,'実装時の契約：選択部分だけを変更。適用前に比較し、適用後も元に戻せる。生成失敗時は入力を保持。保存失敗時は画面離脱前に確認。媒体の更新は人間の編集を黙って置き換えない。\n常設の概念説明は置かない。初回オンボーディングと「使い方」に集約。フォーカスは2pxの緑＋白い間隔、Tab順は左→本文→補助欄。','Small','ink',1376);
// Return current native structure and every changed/new identity for the handoff ledger.
const all=page.findAll(()=>true);return {pageId:page.id,screenIds:Object.fromEntries(Object.entries(screens).map(([k,n])=>[k,n.id])),statesId:states.id,mutatedNodeIds:[...new Set(changed)],createdOrAffectedNodeIds:all.map(n=>n.id),counts:all.reduce((o,n)=>(o[n.type]=(o[n.type]||0)+1,o),{})};
