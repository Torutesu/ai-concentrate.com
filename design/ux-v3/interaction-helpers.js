const page=await figma.getNodeByIdAsync('20:391');await figma.setCurrentPageAsync(page);
await Promise.all(['Regular','Medium','Bold'].map(style=>figma.loadFontAsync({family:'Noto Sans JP',style})));
const vars=Object.fromEntries((await figma.variables.getLocalVariablesAsync()).filter(v=>v.name.startsWith('glass/')).map(v=>[v.name.slice(6),v]));
const styles=Object.fromEntries((await figma.getLocalTextStylesAsync()).map(s=>[s.name.split('/').pop(),s]));
const comps={primary:await figma.getNodeByIdAsync('20:398'),secondary:await figma.getNodeByIdAsync('20:401')};
const created=[],mutated=[],removed=[],links=[],states={};
function paint(key){return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:1,g:1,b:1}},'color',vars[key]);}
function box(p,name,w,dir='VERTICAL',gap=12,pad=0){const n=figma.createAutoLayout(dir);p.appendChild(n);n.name=name;n.resize(w,1);n.primaryAxisSizingMode=dir==='VERTICAL'?'AUTO':'FIXED';n.counterAxisSizingMode=dir==='VERTICAL'?'FIXED':'AUTO';n.fills=[];n.itemSpacing=gap;for(const k of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])n[k]=pad;created.push(n.id);return n;}
function row(p,name,w,gap=12,pad=0){const n=box(p,name,w,'HORIZONTAL',gap,pad);n.counterAxisAlignItems='CENTER';return n;}
function fixed(n,w,h){n.resize(w,h);n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';return n;}
function between(n){n.primaryAxisAlignItems='SPACE_BETWEEN';return n;}
function text(p,value,style='Small',color='ink',w){const n=figma.createText();n.fontName={family:'Noto Sans JP',style:'Regular'};n.characters=value;n.name=value.slice(0,45);n.textStyleId=styles[style].id;n.fills=[paint(color)];p.appendChild(n);if(w){n.textAutoResize='HEIGHT';n.resize(w,n.height);}created.push(n.id);return n;}
function panel(p,name,w,gap=16,pad=20){const n=box(p,name,w,'VERTICAL',gap,pad);n.fills=[paint('white')];n.strokes=[paint('line')];n.cornerRadius=16;return n;}
function button(p,label,dest,primary=false){const c=comps[primary?'primary':'secondary'],n=c.createInstance();p.appendChild(n);n.name='Action / '+label;n.setProperties({[Object.keys(c.componentPropertyDefinitions)[0]]:label});n.fills=[paint(primary?'accent':'white')];if(primary)n.effects=[];created.push(n.id);if(dest)links.push({id:n.id,to:dest});return n;}
function target(n,dest){links.push({id:n.id,to:dest});return n;}
function field(p,label,value,w){const n=box(p,'Field / '+label,w,'VERTICAL',6);text(n,label,'Caption','muted');const v=panel(n,'Input / '+label,w,0,12);v.cornerRadius=8;text(v,value,'Small','ink',w-24);return n;}
function badge(p,label,color='accent'){const n=row(p,'Status / '+label,80,0,6);n.primaryAxisSizingMode='AUTO';n.cornerRadius=6;n.fills=[paint(color==='danger'?'canvas':'mint')];text(n,label,'Caption',color);return n;}
function rule(p,w){const n=box(p,'Divider',w);fixed(n,w,1);n.fills=[paint('line')];return n;}
function clear(n){for(const c of [...n.children]){removed.push(c.id);c.remove();}mutated.push(n.id);}
async function root(id,key,title,clone=false,index=0){let n=await figma.getNodeByIdAsync(id);if(clone){n=n.clone();page.appendChild(n);n.x=80+(index%5)*1520;n.y=7900+Math.floor(index/5)*1060;created.push(n.id,...n.findAll(x=>!x.id.startsWith('I')).map(x=>x.id));}n.name=title;states[key]=n.id;mutated.push(n.id);const main=n.children.find(x=>x.name==='Main'),body=main.children.find(x=>x.name==='Content'),head=main.children.find(x=>x.name==='Page heading');clear(body);clear(head);text(head,title.split(' / ')[0],'Title');body.itemSpacing=16;const bar=main.children.find(x=>x.name==='Workspace bar');const label=bar.findOne(x=>x.type==='TEXT');if(label){label.characters='ShogunAI';mutated.push(label.id);}return {n,main,body,head};}
function split(p,left=320,right=812){const r=row(p,'Work area',1152,20);r.counterAxisAlignItems='MIN';return [panel(r,'Selection',left),panel(r,'Inline workspace',right)];}
function note(p,title,body,w=1104){const n=panel(p,'Feedback / '+title,w,6,14);n.fills=[paint('canvas')];text(n,title,'Label');if(body)text(n,body,'Small','muted',w-28);return n;}
function tabs(p,items,w){const r=row(p,'Local tabs',w,8);for(const [label,dest,active]of items){const n=button(r,label,dest);if(active){n.fills=[paint('mint')];n.effects=[];}}return r;}
function result(){return {states,createdNodeIds:[...new Set(created)].filter(id=>!removed.includes(id)),mutatedNodeIds:[...new Set(mutated)],removedNodeIds:removed,pendingLinks:links};}
async function state(id,key,label,index){const source=await figma.getNodeByIdAsync(id);const n=source.clone();page.appendChild(n);n.name=source.name.split(' / ')[0]+' / '+label;n.x=80+(index%5)*1520;n.y=7900+Math.floor(index/5)*1060;created.push(n.id,...n.findAll(x=>!x.id.startsWith('I')).map(x=>x.id));states[key]=n.id;const body=n.findOne(x=>x.name==='Content');const work=body.children.find(x=>x.name==='Work area');const pane=work?work.children[1]:body;clear(pane);return {n,body,pane};}
function toast(s,label,back){const n=panel(s.body,'Toast',1152,8,14);const r=between(row(n,'Toast actions',1124));text(r,label,'Small');if(back)button(r,'元に戻す',back);return n;}
