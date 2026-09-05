import {story,evidence,endings,fresh,applyNode,finishNode,getChoices,nextNode,choose,recordLine,validateState,cleanSettings,cleanMeta,encodeTransfer,decodeTransfer} from './engine.js';
import {characters} from './story.js';
import {Soundscape} from './audio.js';
import qrcode from './vendor/qrcode.js';
import './vendor/jsQR.js';
const $=id=>document.getElementById(id),storeKey='nagi.archive.v1';
const sound=new Soundscape();let storageOK=true,saveError=false;
let db={slots:Array(6).fill(null),auto:null,previous:null,meta:cleanMeta(),settings:cleanSettings()};
try{const raw=localStorage.getItem(storeKey);if(raw){const d=JSON.parse(raw);db.meta=cleanMeta(d.meta);db.settings=cleanSettings(d.settings);db.slots=Array.from({length:6},(_,i)=>cleanSlot(d.slots?.[i]));db.auto=cleanSlot(d.auto);db.previous=cleanSlot(d.previous);}}catch{saveError=true;}
function cleanSlot(s){try{return s?{state:validateState(s.state),date:typeof s.date==='string'?s.date:'',label:String(s.label||'').slice(0,100)}:null;}catch{return null;}}
let state=null,mode='title',seen=new Set(db.meta.seen),typing=null,autoTimer=null,auto=false,skip=false,choiceMode=false,lastChapter='',lastPortrait='',panelReturn=null,toastTimer=null,lastChoice=null;
const linesById=Object.fromEntries(Object.values(story).flatMap(n=>n.lines.map(l=>[l.id,l])));
function persist(){db.meta.seen=[...seen];try{localStorage.setItem(storeKey,JSON.stringify(db));storageOK=true;return true;}catch{storageOK=false;toast('ブラウザに保存できません。引き継ぎコードを書き出してください。');return false;}}
function clone(s){return structuredClone(s);}
function snapshot(){return {state:clone(state),date:new Date().toISOString(),label:story[state.node].chapter};}
function autosave(){if(state){db.auto=snapshot();persist();}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function stopTimers(){clearInterval(typing);typing=null;clearTimeout(autoTimer);autoTimer=null;}
function stopModes(){auto=false;skip=false;clearTimeout(autoTimer);updateModes();}
function updateModes(){$('auto').setAttribute('aria-pressed',String(auto));$('skip').setAttribute('aria-pressed',String(skip));}
function updateSettings(){document.documentElement.style.setProperty('--font-size',db.settings.fontSize+'px');document.documentElement.classList.toggle('reduced',db.settings.reduced);sound.update(db.settings);}
updateSettings();
function showTitle(){stopTimers();stopModes();if(state)autosave();mode='title';$('title-screen').hidden=false;$('game-screen').hidden=true;$('ending-screen').hidden=true;$('background').style.backgroundImage="url('assets/island.png')";$('background').style.filter='';$('rain').hidden=false;$('continue-game').disabled=!db.auto; sound.setMood('sea');lastChapter='';lastPortrait='';}
function startGame(s=fresh()){const incoming=validateState(s);if(state)db.previous=snapshot();stopTimers();stopModes();state=incoming;mode='game';lastChapter='';lastPortrait='';$('title-screen').hidden=true;$('ending-screen').hidden=true;$('game-screen').hidden=false;sound.start().catch(()=>toast('音声を開始できませんでした。設定から再試行できます。'));render();}
function enter(id){applyNode(state,id);render();}
const locationNames={island:'汀音観測所 / 渡橋',lounge:'汀音観測所 / 食堂',corridor:'汀音観測所 / 廊下',archive:'汀音観測所 / 資料・事務室',studio:'汀音観測所 / 録音室',dawn:'岸へ / 夜明け'};
function render(){
 stopTimers();choiceMode=false;$('choices').hidden=true;$('choices').replaceChildren();$('game-screen').classList.remove('has-choices');
 const n=story[state.node],l=n.lines[state.line];
 if(lastChapter!==n.chapter){
  lastChapter=n.chapter;
  if(!db.meta.checkpoints[n.id]&&state.line===0)db.meta.checkpoints[n.id]=clone(state);
  $('chapter-card').textContent=n.chapter;$('chapter-card').classList.remove('chapter-animate');void $('chapter-card').offsetWidth;$('chapter-card').classList.add('chapter-animate');
 }
 $('chapter').textContent=n.chapter;$('location').textContent=locationNames[n.bg]||'';$('background').style.backgroundImage=`url('assets/${n.bg}.png')`;
 $('background').style.filter=n.mood==='dread'?'saturate(.7) brightness(.8)':'';$('rain').hidden=n.bg==='dawn';sound.setMood(n.mood);
 const c=characters[l.who];$('speaker').textContent=c?.name||l.who||'水瀬 律';$('speaker-role').textContent=c?.role||(l.who?'':'モノローグ');$('speaker').style.color=c?.color||'#d5deda';
 const face=c?.image?c:characters[n.lines.slice(0,state.line+1).findLast(x=>characters[x.who]?.image)?.who];
 if(face?.image){if(lastPortrait!==face.image){$('portrait').src=face.image;lastPortrait=face.image;}$('portrait-wrap').style.opacity='1';}
 else{$('portrait-wrap').style.opacity='0';lastPortrait='';}
 const wasRead=seen.has(l.id);recordLine(state);$('text').replaceChildren();$('dialogue').scrollTop=0;
 $('read-status').textContent=wasRead?'READ / 既読':'NEW / 未読';$('evidence-count').textContent=state.evidence.length;
 if(skip&&!wasRead){skip=false;updateModes();toast('未読の文章でスキップを止めました');}
 const speed=skip?0:db.settings.speed;
 if(speed===0||db.settings.reduced){$('text').textContent=l.text;completeLine();}
 else{
  const shown=document.createElement('span'),pending=document.createElement('span');pending.className='pending';pending.textContent=l.text;$('text').append(shown,pending);let count=0;
  typing=setInterval(()=>{count++;shown.textContent=l.text.slice(0,count);pending.textContent=l.text.slice(count);if(count>=l.text.length){clearInterval(typing);typing=null;completeLine();}},speed);
 }
 if(state.line===0)autosave();
 if(n.id==='broadcast'&&l.text==='かち、かち、かち。')sound.effect('bell');
 if(n.id==='beforeblackout'&&l.text.includes('本当に照明が落ちた'))sound.effect('thunder');
}
function completeLine(){const l=story[state.node].lines[state.line];seen.add(l.id);if(state.line===story[state.node].lines.length-1){const old=state.evidence.length;finishNode(state);if(old<state.evidence.length){$('evidence-count').textContent=state.evidence.length;toast('記録帳に手掛かりを追加しました');}const c=getChoices(state);if(c.length){presentChoices(c);return;}}
 schedule();}
function schedule(){clearTimeout(autoTimer);if($('panel').open||document.hidden||mode!=='game'||choiceMode||typing)return;if(auto||skip)autoTimer=setTimeout(advance,skip?45:db.settings.autoDelay+story[state.node].lines[state.line].text.length*45);}
function reveal(){if(!typing)return;clearInterval(typing);typing=null;$('text').textContent=story[state.node].lines[state.line].text;completeLine();}
function advance(){
 if(mode!=='game'||$('panel').open||choiceMode)return;
 if(typing){reveal();return;}
 const n=story[state.node];
 if(state.line<n.lines.length-1){state.line++;render();return;}
 finishNode(state);
 if(n.ending){showEnding(n.ending);return;}
 const c=getChoices(state);if(c.length){presentChoices(c);return;}
 const next=nextNode(state);if(next)enter(next);else toast('次の場面を読み込めませんでした。記録を保存して再読込してください。');
}
function presentChoices(c){stopModes();choiceMode=true;$('choices').hidden=false;$('choices').replaceChildren();$('game-screen').classList.add('has-choices');lastChoice=clone(state);autosave();
 c.forEach((item,i)=>{const b=document.createElement('button');b.className='choice';b.disabled=!!item.disabled;const idx=document.createElement('span');idx.className='choice-index';idx.textContent=String(i+1).padStart(2,'0');const label=document.createElement('span');label.textContent=item.label;if(item.disabled){const small=document.createElement('small');small.textContent='記録が不足しています。調査へ戻ると選べるようになります。';label.append(small);}b.append(idx,label);b.onclick=()=>{sound.effect('choice');choose(state,i);render();};$('choices').append(b);});
}
function showEnding(id){stopTimers();stopModes();mode='ending';if(!db.meta.endings.includes(id))db.meta.endings.push(id);autosave();$('game-screen').hidden=true;$('ending-screen').hidden=false;const e=endings[id];$('ending-name').textContent=e.name;$('ending-subtitle').textContent=e.subtitle;$('ending-number').textContent=`ENDING ${String(Object.keys(endings).indexOf(id)+1).padStart(2,'0')}`;$('return-choice').disabled=!lastChoice;sound.effect('bell');}
function el(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function button(text,fn,className){const b=el('button',text,className);b.onclick=fn;return b;}
function closePanel(){$('panel').close();schedule();panelReturn?.focus();}
function modal(title){reveal();clearTimeout(autoTimer);panelReturn=document.activeElement;$('panel-title').textContent=title;$('panel-body').replaceChildren();if(!$('panel').open)$('panel').showModal();$('panel').scrollTop=0;return $('panel-body');}
function confirmAction(title,copy,fn){const body=modal(title);body.append(el('p',copy,'confirm-copy'));const row=el('div',undefined,'button-row');row.append(button('やめる',closePanel),button('進める',()=>{closePanel();fn();},'primary'));body.append(row);}
function openPanel(type){
 const titles={menu:'夜のしおり',save:'記録を残す',load:'記録をひらく',settings:'読み方を整える',backlog:'これまでの言葉',evidence:'記録帳',endings:'結末の栞',transfer:'声を、別の端末へ',about:'この作品について',chapters:'章から読み返す'};
 const body=modal(titles[type]||type);
 if(type==='menu'){
  const list=el('div',undefined,'menu-list');for(const [key,name]of [['save','セーブ'],['load','ロード'],['backlog','バックログ'],['evidence','記録帳'],['transfer','引き継ぎ'],['settings','設定'],['about','作品・操作について']])list.append(button(name,()=>openPanel(key)));list.append(button('タイトルへ戻る',()=>confirmAction('タイトルへ','現在位置を自動保存して、タイトルへ戻ります。',showTitle)));body.append(list);
 }else if(type==='save'||type==='load'){
  body.append(el('p',type==='save'?'端末のブラウザに保存します。上書き前に確認できます。':'保存した時点へ戻ります。ロード前の現在位置は「読み込み前の記録」に残します。','panel-note'));
  if(!storageOK)body.append(el('p','このブラウザでは保存できていません。引き継ぎコードをご利用ください。','panel-note'));
  if(type==='load'&&db.auto)body.append(slotButton(db.auto,'AUTO / 自動保存',()=>loadSlot(db.auto)));
  if(type==='load'&&db.previous)body.append(slotButton(db.previous,'BACK / 読み込み前の記録',()=>loadSlot(db.previous)));
  const grid=el('div',undefined,'panel-grid');db.slots.forEach((s,i)=>{const b=slotButton(s,`記録 ${String(i+1).padStart(2,'0')}`,()=>{if(type==='save'){const save=()=>{db.slots[i]=snapshot();const ok=persist();openPanel('save');if(ok)toast('記録を保存しました');};if(s)confirmAction('記録の上書き',`記録 ${i+1} を現在位置で上書きします。`,save);else save();}else if(s)loadSlot(s);});b.disabled=type==='save'?!state:!s;grid.append(b);});body.append(grid);
 }else if(type==='settings'){
  body.append(el('p','設定はこのブラウザに保存されます。音は開始操作のあとに流れます。','panel-note'),el('p','小さな音のほうが、よく残るんです。','preview-text'));
  for(const [key,label,min,max,step,unit]of [['speed','文字の表示間隔',0,70,1,' ms（0で一括）'],['fontSize','文字サイズ',17,30,1,' px'],['music','音楽',0,100,1,' %'],['ambient','雨・環境音',0,100,1,' %'],['effects','効果音',0,100,1,' %'],['autoDelay','オートの待ち時間',600,7000,100,' ms ＋ 文章の長さ']]){
   const row=el('div',undefined,'setting-row'),labelEl=el('label',label),out=el('output',db.settings[key]+unit),input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=db.settings[key];input.id='setting-'+key;labelEl.htmlFor=input.id;labelEl.append(out);input.oninput=()=>{db.settings[key]=Number(input.value);out.textContent=input.value+unit;updateSettings();persist();};row.append(labelEl,input);body.append(row);
  }
  const label=el('label'),check=document.createElement('input');check.type='checkbox';check.checked=db.settings.reduced;check.onchange=()=>{db.settings.reduced=check.checked;updateSettings();persist();};label.append(check,document.createTextNode('動きを抑える・本文を一括表示'));body.append(label,el('p','音量の確認は下のボタンから。ブラウザを離れると音と自動送りを一時停止します。','panel-note'),button('音を試す / 再開',async()=>{await sound.start();sound.effect('bell');}));
 }else if(type==='backlog'){
  if(!state?.trail.length)body.append(el('p','まだ履歴はありません。','panel-note'));
  for(const id of state?.trail||[]){const l=linesById[id],item=el('article',undefined,'log-item');item.append(el('strong',characters[l.who]?.name||l.who||'水瀬 律 · モノローグ'),el('p',l.text));body.append(item);}requestAnimationFrame(()=>$('panel').scrollTop=$('panel').scrollHeight);
 }else if(type==='evidence'){
  body.append(el('p','今の進行で確認した事実だけを記録しています。解釈と事実を、分けて読むために。','panel-note'));
  const map=el('div',undefined,'map');['食堂｜皆が集まる部屋','事務室｜鍵と書類','資料室｜音源の整理','録音室｜自動施錠の扉'].forEach(t=>map.append(el('div',t)));body.append(map);
  if(!state?.evidence.length)body.append(el('p','読み進めると、手掛かりがここに増えていきます。','panel-note'));
  for(const id of state?.evidence||[]){const card=el('article',undefined,'evidence-card');card.append(el('h3',evidence[id].title),el('p',evidence[id].text));body.append(card);}
 }else if(type==='endings'){
  body.append(el('p',`読了 ${db.meta.endings.length} / ${Object.keys(endings).length}。未到達の名前と内容は表示しません。`,'panel-note'));
  Object.entries(endings).forEach(([id,e],i)=>{const unlocked=db.meta.endings.includes(id),card=el('article',undefined,'ending-item');card.append(el('small',`BOOKMARK ${String(i+1).padStart(2,'0')}`),el('h3',unlocked?e.name:'まだ読まれていない結末'));if(unlocked){card.append(el('p',e.subtitle));const details=el('details');details.append(el('summary','別の道へのヒントを見る'),el('p',e.hint));card.append(details);}body.append(card);});
  if(db.meta.endings.length)body.append(button('章から読み返す',()=>openPanel('chapters'),'primary'));
 }else if(type==='chapters'){
  body.append(el('p','実際に到達した章の開始時点へ戻ります。そのときの調査・選択も復元されます。既読・読了記録は残ります。','panel-note'));
  const list=el('div',undefined,'chapter-select');for(const [id,s]of Object.entries(db.meta.checkpoints)){list.append(button(story[id].chapter,()=>confirmAction('この章から読む','現在位置を自動保存し、選んだ章の開始時点へ移動します。',()=>{if(state)autosave();startGame(s);})))}body.append(list);
 }else if(type==='transfer'){renderTransfer(body);
 }else if(type==='about'){
  const box=el('div',undefined,'about');box.innerHTML='<h3>凪のあとに、声が残る</h3><p>嵐で孤立した音響観測所を舞台にした、オリジナル・ミステリービジュアルノベルです。調査と行動によって物語が分かれます。好感度などの数値はありません。</p><p>人の死、事故、喪失を扱います。流血の画像や突然の大音量演出はありません。音に関する手掛かりは、すべて文章でも示されます。</p><h3>操作</h3><dl><dt>クリック / タップ / Enter / Space</dt><dd>文章を表示、もう一度で次へ</dd><dt>Esc</dt><dd>メニュー / パネルを閉じる</dd><dt>L / S / A</dt><dd>履歴 / セーブ / オート</dd><dt>既読スキップ</dt><dd>読んだ文章だけを送り、選択肢や未読で止まります</dd></dl><h3>保存と引き継ぎ</h3><p>手動6枠と自動1枠。ブラウザのデータ削除やプライベートモードにご注意ください。端末を替える前に引き継ぎコードを保存できます。コードには現在位置・調査・履歴・既読・読了記録を含みます。手動保存枠・設定・章の栞は端末ごとです。</p><h3>制作</h3><p>企画・脚本・プログラム・美術ディレクション：こでちゃん（Codex）<br>背景・人物：本作用に画像生成したオリジナル素材<br>音楽・雨・効果音：本作用のWeb Audio合成音<br>エンジン：HTML / CSS / JavaScript</p><p>本作はフィクションです。登場する人物・施設・事件は架空のものです。既存作品の文章・音楽・画像は使用していません。音声の台詞読み上げはありません。</p><p>v1.0 · NAGI ARCHIVE<br>公開先への通信、広告、アクセス解析はありません。</p>';
  body.append(box);
 }
}
function slotButton(s,name,fn){const b=button('',fn,'slot'+(!s?' empty':''));b.append(el('strong',name),el('span',s?s.label:'空の記録'));if(s){const date=new Date(s.date);b.append(el('small',Number.isNaN(+date)?'保存日時不明':date.toLocaleString('ja-JP')));}return b;}
function loadSlot(slot){const s=clone(slot.state);confirmAction('記録を読み込む','保存した位置から再開します。現在位置は「読み込み前の記録」に残ります。',()=>{if(state)autosave();lastChoice=null;startGame(s);});}
async function renderTransfer(body){
 body.append(el('p','コードをコピーして、別端末の同じゲームの「引き継ぎ」に貼り付けてください。ファイルでも移せます。読み込み前に確認が表示されます。','panel-note'));
 const output=document.createElement('textarea');output.id='export-code';output.readOnly=true;output.setAttribute('aria-label','発行した引き継ぎコード');output.placeholder='本編を開始するとコードを発行できます';body.append(el('p','この端末から持ち出す','section-label'),output);
 const row=el('div',undefined,'button-row');const current=state||db.auto?.state;
 const qrWrap=el('div',undefined,'qr-wrap');qrWrap.hidden=true;
 const exportButton=button('コードを発行',async()=>{try{output.value=await encodeTransfer(current,{...db.meta,seen:[...seen]});qrWrap.replaceChildren();try{const qr=qrcode(0,'M');qr.addData(output.value);qr.make();const qrImage=el('img');qrImage.alt='引き継ぎコードのQRコード';qrImage.src=qr.createDataURL(4,16);qrWrap.append(qrImage,el('p','別端末のQR読み取り機能でテキストとして読み取り、この作品の引き継ぎ欄へ貼り付けてください。','panel-note'));qrWrap.hidden=false;}catch{qrWrap.append(el('p','記録が長いためQR表示は省略します。コードまたはファイルで引き継げます。','panel-note'));qrWrap.hidden=false;}toast('コードを発行しました。全文を保存してください。');}catch(e){toast(e.message);}});exportButton.disabled=!current;
 row.append(exportButton,button('コピー',async()=>{if(!output.value){toast('先にコードを発行してください');return;}try{await navigator.clipboard.writeText(output.value);toast('コピーしました');}catch{output.select();toast('コードを選択しました。端末のコピー操作をご利用ください');}}),button('ファイル保存',()=>{if(!output.value){toast('先にコードを発行してください');return;}const url=URL.createObjectURL(new Blob([output.value],{type:'text/plain;charset=utf-8'})),a=el('a');a.href=url;a.download='nagi-transfer.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));body.append(row);
 body.append(qrWrap);const input=document.createElement('textarea');input.id='import-code';input.placeholder='NAGI1 で始まるコードを全文貼り付け';input.setAttribute('aria-label','読み込む引き継ぎコード');body.append(el('p','別の端末から受け取る','section-label'),input);
 const file=document.createElement('input');file.type='file';file.accept='.txt,text/plain';file.setAttribute('aria-label','引き継ぎファイルを選ぶ');file.onchange=async()=>{const f=file.files[0];if(!f)return;if(f.size>150000){toast('ファイルが大きすぎます');return;}input.value=await f.text();};body.append(file);
 const qrLabel=el('label','QRの画像・写真から読み取る','section-label');qrLabel.style.display='block';const qrFile=document.createElement('input');qrFile.type='file';qrFile.accept='image/*';qrFile.id='qr-file';qrFile.setAttribute('aria-label','QRコードの画像を選ぶ');qrFile.onchange=async()=>{const f=qrFile.files[0];if(!f)return;if(f.size>20000000){toast('20MB以下の画像を選んでください');return;}const url=URL.createObjectURL(f);try{const im=new Image();im.src=url;await im.decode();const ratio=Math.min(1,1800/Math.max(im.width,im.height)),canvas=document.createElement('canvas');canvas.width=Math.round(im.width*ratio);canvas.height=Math.round(im.height*ratio);const context=canvas.getContext('2d');context.drawImage(im,0,0,canvas.width,canvas.height);const pixels=context.getImageData(0,0,canvas.width,canvas.height),result=window.jsQR(pixels.data,pixels.width,pixels.height);if(!result)throw new Error('QRを読み取れませんでした。正面から明るく撮った画像をお試しください。');input.value=result.data;toast('QRを読み取りました。「コードを確かめる」で復元できます。');}catch(e){toast(e.message||'画像を読み取れませんでした');}finally{URL.revokeObjectURL(url);}};qrLabel.append(qrFile);body.append(qrLabel);
 const err=el('p','','panel-note');err.setAttribute('role','alert');const importButton=button('コードを確かめる',async()=>{try{const imported=await decodeTransfer(input.value);confirmAction('引き継ぎの確認',`${story[imported.state.node].chapter} の記録を読み込みます。手動セーブは残り、既読・読了記録は統合されます。`,()=>{if(state)autosave();db.meta.endings=[...new Set([...db.meta.endings,...imported.meta.endings])];for(const id of imported.meta.seen)seen.add(id);lastChoice=null;startGame(imported.state);autosave();toast('引き継ぎを復元しました');});}catch(e){err.textContent=e.message;}} ,'primary');const importRow=el('div',undefined,'button-row');importRow.append(importButton);body.append(importRow,err);
}
$('new-game').onclick=()=>{sound.start().catch(()=>{});if(db.auto)confirmAction('はじめから読む','手動セーブと既読・読了記録は残ります。自動保存は新しい物語で更新されます。',()=>{lastChoice=null;startGame();});else startGame();};
$('continue-game').onclick=()=>{if(db.auto){lastChoice=null;startGame(db.auto.state);}};
$('dialogue').onclick=()=>{sound.effect();advance();};$('dialogue').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();advance();}};
$('menu-button').onclick=()=>openPanel('menu');$('close-panel').onclick=closePanel;
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(b.dataset.panel));
$('panel').addEventListener('cancel',()=>{schedule();});$('panel').addEventListener('close',schedule);
$('auto').onclick=()=>{auto=!auto;skip=false;updateModes();schedule();};$('skip').onclick=()=>{skip=!skip;auto=false;updateModes();if(skip){const id=story[state.node].lines[state.line].id;if(!seen.has(id)){skip=false;updateModes();toast('未読の文章はスキップしません');}else{reveal();schedule();}}};
$('ending-title').onclick=showTitle;$('return-choice').onclick=()=>{if(lastChoice)startGame(lastChoice);};
document.addEventListener('keydown',e=>{if($('panel').open||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName))return;if(e.key==='Escape'&&mode==='game'){e.preventDefault();openPanel('menu');}else if(mode==='game'){if([' ','Enter','ArrowRight'].includes(e.key)){e.preventDefault();advance();}else if(e.key.toLowerCase()==='l')openPanel('backlog');else if(e.key.toLowerCase()==='s')openPanel('save');else if(e.key.toLowerCase()==='a')$('auto').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(autoTimer);if(state)autosave();sound.pause().catch(()=>{});}else{sound.resume().catch(()=>{});schedule();}});
window.addEventListener('pagehide',()=>{if(state)autosave();});
showTitle();if(saveError)toast('保存データを読み取れませんでした。引き継ぎコードがあれば復元できます。');
