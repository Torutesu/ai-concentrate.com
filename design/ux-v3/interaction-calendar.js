async function calendar(key,mode,index,state='selected'){
const s=await root('22:1085',key,'カレンダー'+(key==='calendar'?'':' / '+state),key!=='calendar',index);
button(s.head,'予定を追加','calendarNew',true);
const controls=between(row(s.body,'Calendar toolbar',1152));const date=row(controls,'Month navigation',500,12);button(date,'‹','calendarSeptember');text(date,'2026年10月','Card title');button(date,'›','calendarNovember');button(date,'今日','calendar');tabs(controls,[['月','calendar',mode==='month'],['週','calendarWeek',mode==='week']],170);button(controls,'全媒体 ▾','calendarFilter');
const area=row(s.body,'Calendar and inspector',1152,20);area.counterAxisAlignItems='MIN';const cal=panel(area,'Calendar grid',792,0,12),detail=panel(area,'Post inspector',340,14,20);
const days=row(cal,'Days of week',768,0);for(const d of ['月','火','水','木','金','土','日'])text(days,d,'Caption','muted',109.7);
if(mode==='month'){
const posts={5:['09:00  X','月曜の仕事復帰','承認待ち'],6:['12:00  LinkedIn','Pick up where…','下書き'],7:['10:00  記事','文脈を取り戻す','接続が必要'],9:['18:00  動画','仕事の再開','制作中'],12:['09:00  X','背景説明、何回？','予約済み'],16:['12:00  LinkedIn','A little context','下書き'],21:['10:00  記事','会議5分前','下書き'],26:['09:00  X','自分の城を作る','下書き']};
for(let week=0;week<5;week++){const wr=row(cal,'Week '+week,768,0);for(let day=0;day<7;day++){let d=week*7+day-2;const adjacent=d<1||d>31;const label=d<1?d+30:d>31?d-31:d;const cell=box(wr,'Day / '+d,109.7,'VERTICAL',7,7);fixed(cell,109.7,116);cell.strokes=[paint('line')];cell.strokeWeight=.5;if(d===5)cell.fills=[paint('mint')];text(cell,String(label),'Label',adjacent?'muted':'ink');if(d===2)text(cell,'今日','Caption','accent');if(posts[d]){const event=box(cell,'Event / '+d,95.7,'VERTICAL',3,3);text(event,posts[d][0],'Caption','accent',89);text(event,posts[d][1],'Caption','ink',89);text(event,state==='scheduled'&&d===5?'予約済み':posts[d][2],'Caption','muted',89);target(event,d===7?'calendarDisconnected':'calendar');}else target(cell,'calendarNew');}}
}else{const grid=box(cal,'Week timetable',768,'VERTICAL',0);for(const hour of ['09:00','12:00','15:00','18:00']){const r=row(grid,'Time '+hour,768,0);for(let d=0;d<7;d++){const c=box(r,'Time slot',109.7,'VERTICAL',7,7);fixed(c,109.7,145);c.strokes=[paint('line')];c.strokeWeight=.5;text(c,d===0?hour:'','Caption','muted');if((hour==='09:00'&&d===0)||(hour==='12:00'&&d===1)){badge(c,d===0?'X':'LinkedIn');text(c,d===0?'月曜の仕事復帰':'Pick up where…','Caption','ink',95);target(c,'calendar');}}}}
text(cal,'Asia/Tokyo  ·  日時は投稿先に送信する前に確認','Caption','muted',768);
text(detail,state==='new'?'新しい予定':'月曜の仕事復帰','Card title');badge(detail,state==='scheduled'?'予約済み':state==='failed'?'公開失敗':'承認待ち');
field(detail,'投稿先','X / @shogunai_demo',300);field(detail,'日時','10月5日（月）09:00',300);field(detail,'タイムゾーン','Asia/Tokyo（UTC+9）',300);field(detail,'本文','月曜の朝、最初の仕事が「先週の仕事を思い出すこと」になっていませんか。',300);
if(state==='disconnected'){note(detail,'接続が切れています','予定は保持されています。再接続して続けられます。',300);button(detail,'再接続','calendarConnect',true);}
else if(state==='scheduled'){text(detail,'2026/10/05 09:00 に公開予定','Caption','accent',300);button(detail,'日時を変更','calendarReschedule');button(detail,'予約を取り消す','calendarCancel');}
else if(state==='failed'){text(detail,'投稿先からの応答を確認できませんでした。','Small','danger',300);button(detail,'公開状況を確認','calendarReconciling',true);}
else{button(detail,'予約内容を確認','calendarConfirm',true);button(detail,'下書きを保存','calendarSaved');}
return s;
}
await calendar('calendar','month',0);
await calendar('calendarWeek','week',0,'週表示');
await calendar('calendarScheduled','month',1,'scheduled');
await calendar('calendarDisconnected','month',2,'disconnected');
return result();
