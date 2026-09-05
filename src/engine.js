import {story,evidence,endings} from './story.js';
import './story-extra.js';
export {story,evidence,endings};
export const VERSION=1;
export const LINE_IDS=Object.values(story).flatMap(n=>n.lines.map(l=>l.id));
const lineSet=new Set(LINE_IDS);
const boolFlags=['shared','equipment','office','testimony','listened','solved','together','lost','finishedTape','revisiting','sheltered'];
export const fresh=()=>({node:'arrival',line:0,flags:{visits:0},evidence:[],trail:[],steps:0});
export function applyNode(state,id){
 if(!story[id])throw new Error('存在しない場面です');
 state.node=id;state.line=0;state.steps++;
 Object.assign(state.flags,story[id].set||{});
 return state;
}
export function finishNode(s){for(const key of story[s.node].grant||[])if(!s.evidence.includes(key))s.evidence.push(key);}
export function getChoices(s){
 const n=story[s.node];
 if(n.hub||n.review){
  const c=[];
  for(const [flag,label,to] of [['equipment','放送設備を調べる','equipment'],['office','事務室の記録を読む','office'],['testimony','食堂で証言を聞く','testimony']]) {
   if(!s.flags[flag])c.push({label,to,set:{revisiting:!!n.review}});
  }
  if(n.review){
   if(s.flags.testimony&&!s.evidence.includes('witness'))c.push({label:'黒田の話を、今度は最後まで聞く',to:'witness_kind',set:{revisiting:true,listened:true}});
   c.push({label:'集めた事実から考え直す',to:'theory'});
  }
  return c;
 }
 return (n.choices||[]).map(c=>({...c,disabled:!!c.need?.some(e=>!s.evidence.includes(e))}));
}
export function nextNode(s){
 const n=story[s.node];
 if(n.afterVisit){s.flags.visits=(s.flags.visits||0)+1;return s.flags.revisiting?'review':s.flags.visits>=2?'interval':'hub';}
 if(n.routeAfterConfession)return s.flags.lost?'ash_end':'listen_choice';
 if(n.afterTape)return s.flags.together?'voice_end':'shore_end';
 if(n.accountGate)return s.evidence.includes('witness')?'account_witness':'account_paper';
 return n.next;
}
export function choose(s,index){const c=getChoices(s)[index];if(!c||c.disabled)throw new Error('この選択肢は選べません');Object.assign(s.flags,c.set||{});applyNode(s,c.to);}
export function recordLine(s){const l=story[s.node].lines[s.line];if(l&&s.trail.at(-1)!==l.id)s.trail.push(l.id);if(s.trail.length>4000)s.trail.shift();}
export function validateState(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('進行データがありません');
 const n=story[value.node];
 if(!n||!Number.isInteger(value.line)||value.line<0||value.line>=n.lines.length)throw new Error('場面またはページが不正です');
 const flags={visits:0};
 if(value.flags&&typeof value.flags==='object'){
  for(const k of boolFlags)if(k in value.flags){if(typeof value.flags[k]!=='boolean')throw new Error('分岐情報が不正です');flags[k]=value.flags[k];}
  if('visits' in value.flags){if(!Number.isInteger(value.flags.visits)||value.flags.visits<0||value.flags.visits>1000)throw new Error('調査回数が不正です');flags.visits=value.flags.visits;}
 }
 if(!Array.isArray(value.evidence)||value.evidence.some(k=>!Object.hasOwn(evidence,k)))throw new Error('手掛かり情報が不正です');
 if(!Array.isArray(value.trail)||value.trail.length>4000||value.trail.some(k=>!lineSet.has(k)))throw new Error('履歴情報が不正です');
 return {node:value.node,line:value.line,flags,evidence:[...new Set(value.evidence)],trail:[...value.trail],steps:Math.min(100000,Math.max(0,Number(value.steps)||0))};
}
export const settingsDefault={speed:28,fontSize:21,music:35,ambient:28,effects:40,autoDelay:1800,reduced:false};
export function cleanSettings(s={}){
 const result={...settingsDefault};
 for(const [k,min,max] of [['speed',0,70],['fontSize',17,30],['music',0,100],['ambient',0,100],['effects',0,100],['autoDelay',600,7000]])if(Number.isFinite(s[k]))result[k]=Math.min(max,Math.max(min,s[k]));
 result.reduced=s.reduced===true;return result;
}
export function cleanMeta(m={}){
 return {seen:Array.isArray(m.seen)?[...new Set(m.seen.filter(x=>lineSet.has(x)))]:[],endings:Array.isArray(m.endings)?[...new Set(m.endings.filter(x=>Object.hasOwn(endings,x)))]:[],checkpoints:Object.fromEntries(Object.entries(m.checkpoints||{}).filter(([id])=>Object.hasOwn(story,id)).flatMap(([id,s])=>{try{return [[id,validateState(s)]];}catch{return [];}}))};
}
export function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function fromBase64(s){return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
function runs(ids){const out=[];for(const id of ids){const i=LINE_IDS.indexOf(id),last=out.at(-1);if(last&&last[0]+last[1]===i)last[1]++;else out.push([i,1]);}return out;}
function expandRuns(list){if(!Array.isArray(list)||list.length>4000)throw new Error('既読記録が不正です');const out=[];for(const pair of list){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!Number.isInteger(pair[1])||pair[0]<0||pair[1]<1||pair[0]+pair[1]>LINE_IDS.length||out.length+pair[1]>4000)throw new Error('既読記録の範囲が不正です');for(let j=0;j<pair[1];j++)out.push(LINE_IDS[pair[0]+j]);}return out;}
export async function encodeTransfer(state,meta){
 const s=validateState(state),m=cleanMeta(meta);
 // Dictionary indices keep already-read data compact. Checkpoints are regenerated on the destination.
 const payload=JSON.stringify({v:VERSION,r:1,s:{...s,trail:runs(s.trail)},seen:runs(m.seen),ends:m.endings});
 let bytes=new TextEncoder().encode(payload),type='U';
 if(typeof CompressionStream!=='undefined'){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());type='Z';}
 const data=toBase64(bytes);return `NAGI1${type}.${data}.${hash(data)}`;
}
export async function decodeTransfer(code){
 const raw=code.trim().replace(/\s+/g,'');if(raw.length>150000)throw new Error('コードが長すぎます');
 const match=/^NAGI1([UZ])\.([A-Za-z0-9_-]+)\.([a-z0-9]+)$/.exec(raw);
 if(!match||hash(match[2])!==match[3])throw new Error('コードが欠けているか、この作品のコードではありません');
 let bytes=fromBase64(match[2]);
 if(match[1]==='Z'){
  if(typeof DecompressionStream==='undefined')throw new Error('このブラウザでは復元できません。最新版をお試しください');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let size=0,parts=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();throw new Error('展開後のデータが大きすぎます');}parts.push(value);}
  bytes=new Uint8Array(size);let pos=0;for(const p of parts){bytes.set(p,pos);pos+=p.length;}
 }
 let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('コードのデータを読み取れません');}
 if(data.v!==VERSION||!Array.isArray(data.s?.trail)||!Array.isArray(data.seen)||!Array.isArray(data.ends))throw new Error('対応していないデータ形式です');
 const indexToId=i=>{if(!Number.isInteger(i)||!LINE_IDS[i])throw new Error('既読データが不正です');return LINE_IDS[i];};
 data.s.trail=data.r===1?expandRuns(data.s.trail):data.s.trail.map(indexToId);
 return {state:validateState(data.s),meta:cleanMeta({seen:data.r===1?expandRuns(data.seen):data.seen.map(indexToId),endings:data.ends})};
}
