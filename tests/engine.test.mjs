import test from 'node:test';
import assert from 'node:assert/strict';
import {story,evidence,endings,fresh,applyNode,finishNode,getChoices,nextNode,choose,validateState,encodeTransfer,decodeTransfer,cleanMeta,LINE_IDS,hash} from '../src/engine.js';
import fs from 'node:fs';
export function explore(){
 const queue=[{s:fresh(),path:[],chars:0}],visited=new Set(),nodes=new Set(),endPaths={};
 while(queue.length){const {s,path,chars}=queue.shift();const sig=JSON.stringify([s.node,s.flags,s.evidence.slice().sort()]);if(visited.has(sig))continue;visited.add(sig);assert.ok(visited.size<15000,'graph must converge');nodes.add(s.node);const n=story[s.node];const total=chars+n.lines.reduce((a,l)=>a+l.text.length,0);const p=[...path,s.node];finishNode(s);
  if(n.ending){(endPaths[n.ending]??=[]).push({path:p,chars:total});continue;}
  const choices=getChoices(s);if(choices.length){for(let i=0;i<choices.length;i++){if(choices[i].disabled)continue;const v=structuredClone(s);choose(v,i);queue.push({s:v,path:p,chars:total});}}
  else{const id=nextNode(s);assert.ok(id,`Dead end ${s.node}`);const v=structuredClone(s);applyNode(v,id);queue.push({s:v,path:p,chars:total});}
 }
 return {nodes,endPaths,states:visited.size};
}
test('all nodes and all endings reachable with coherent choices',()=>{const r=explore();assert.deepEqual([...r.nodes].sort(),Object.keys(story).sort());assert.deepEqual(Object.keys(r.endPaths).sort(),Object.keys(endings).sort());});
test('unique line ids, valid assets and fair pre-incident clues',()=>{
 assert.equal(new Set(LINE_IDS).size,LINE_IDS.length);
 for(const n of Object.values(story)){assert.ok(n.lines.length);assert.ok(fs.existsSync(`assets/${n.bg}.png`),n.bg);for(const e of n.grant||[])assert.ok(evidence[e]);for(const c of n.choices||[]){assert.ok(story[c.to]);for(const e of c.need||[])assert.ok(evidence[e]);}}
 assert.deepEqual(story.tour.grant,['door','battery']);assert.deepEqual(story.recording.grant,['test','clock']);
});
test('deductions locked until investigation, no relation points',()=>{const s=fresh();applyNode(s,'theory');assert.equal(getChoices(s)[1].disabled,true);s.evidence.push('log');assert.equal(getChoices(s)[1].disabled,false);assert.equal('affection' in s.flags,false);});
test('save and transfer round trip and corruption rejection',async()=>{
 const s=fresh();s.node='opportunity';s.line=3;s.flags={visits:2,equipment:true,office:true,solved:true};s.evidence=['log','key','report','tape'];s.trail=LINE_IDS.slice(0,1000);
 const meta=cleanMeta({seen:LINE_IDS.slice(0,1300),endings:['storm','glass']});const code=await encodeTransfer(s,meta);const result=await decodeTransfer(code);assert.deepEqual(result.state,s);assert.deepEqual(result.meta.seen,meta.seen);assert.deepEqual(result.meta.endings,meta.endings);
 await assert.rejects(decodeTransfer(code.slice(0,-1)+'!'));await assert.rejects(decodeTransfer('junk'));await assert.rejects(decodeTransfer('x'.repeat(150001)));await assert.rejects(decodeTransfer('NAGI1U.W10.'+hash('W10')));
});
test('malformed states are rejected without executable fields',()=>{assert.throws(()=>validateState({...fresh(),node:'__proto__'}));assert.throws(()=>validateState({...fresh(),line:1e9}));assert.throws(()=>validateState({...fresh(),flags:{visits:-1}}));assert.throws(()=>validateState({...fresh(),evidence:['fake']}));assert.throws(()=>validateState({...fresh(),trail:['<script>']}));assert.deepEqual(validateState({...fresh(),html:'<script>'}),fresh());});
test('story volume report',()=>{const r=explore();const data={nodes:Object.keys(story).length,paragraphs:LINE_IDS.length,totalCharacters:Object.values(story).reduce((a,n)=>a+n.lines.reduce((b,l)=>b+l.text.length,0),0),states:r.states,endings:Object.fromEntries(Object.entries(r.endPaths).map(([e,paths])=>[e,{paths:paths.length,min:Math.min(...paths.map(p=>p.chars)),max:Math.max(...paths.map(p=>p.chars))}]))};fs.writeFileSync('docs/spoilers/metrics.json',JSON.stringify(data,null,2));assert.ok(data.totalCharacters>30000);});
