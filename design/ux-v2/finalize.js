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
const edited=[];async function go(n,id){await n.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:id,navigation:'NAVIGATE',transition:null}]}]);edited.push(n.id);}
const video=await figma.getNodeByIdAsync('16:686');const p=video.findOne(n=>n.name==='Channel editor');bind(p,'itemSpacing',12);for(const c of p.children){if(c.type==='FRAME'&&c.name.startsWith('Scene 0')){bind(c,'itemSpacing',6);for(const k of ['paddingTop','paddingRight','paddingBottom','paddingLeft'])bind(c,k,12);}}edited.push(p.id,...p.findAll(()=>true).map(n=>n.id));
const updated=await figma.getNodeByIdAsync('16:587');const review=updated.findOne(n=>n.name==='Review');if(!review.children.some(n=>n.type==='INSTANCE'))await go(btn(review,'制作待ちにする','primary'),'15:1387');
// Applying an AI change has an observable result and a reversible action.
const orig=await figma.getNodeByIdAsync('15:1069');const applied=orig.clone();page.appendChild(applied);applied.name='10 / 選択箇所の変更を適用';applied.x=6160;applied.y=1140;
applied.findOne(n=>n.name==='Selected paragraph').findOne(n=>n.type==='TEXT').characters='思い出したいのは、決めたこと、その理由、残った論点。そのつながりだ。';
const footer=applied.findOne(n=>n.name==='Document footer');for(const n of [...footer.children])n.remove();txt(footer,'✓ 選択箇所を変更しました','Caption','green');await go(btn(footer,'元に戻す'),'15:1069');await go(await figma.getNodeByIdAsync('16:849'),applied.id);
// Review content uses labels, not unsupported performance or customer evidence.
const guide=await figma.getNodeByIdAsync('15:1451');txt(guide,'検証範囲：デスクトップ主要フロー。静的テキスト入力、検索・フィルタ、ブランド設定、コピー・書き出しは画面仕様のみ。実AI、保存、生成、ファイル出力の実行テストではありません。','Small','ink',1376);
const screenFrames=page.children.filter(n=>n.type==='FRAME'&&/^\d\d \//.test(n.name));const overflow=[];
for(const root of screenFrames){for(const n of root.findAllWithCriteria({types:['TEXT','INSTANCE']})){const r=n.absoluteBoundingBox,rr=root.absoluteBoundingBox;if(r&&(r.x<rr.x-1||r.y<rr.y-1||r.x+r.width>rr.x+rr.width+1||r.y+r.height>rr.y+rr.height+1))overflow.push({id:n.id,name:n.name,screen:root.name});}}
const reactionNodes=page.findAll(n=>'reactions'in n&&n.reactions.length>0);const reactions=reactionNodes.map(n=>({source:n.id,name:n.name,actions:n.reactions.flatMap(r=>r.actions||[])}));
return {appliedEditorId:applied.id,createdNodeIds:[applied.id,...applied.findAll(()=>true).map(n=>n.id),...review.findAll(()=>true).map(n=>n.id),...guide.findAll(()=>true).map(n=>n.id)],mutatedNodeIds:edited,overflow,reactions,screenCount:screenFrames.length,screens:screenFrames.map(n=>({id:n.id,name:n.name,width:n.width,height:n.height})),imageNodes:page.findAll(n=>'fills'in n&&Array.isArray(n.fills)&&n.fills.some(p=>p.type==='IMAGE')).length};
