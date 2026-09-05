// Original procedural score. No samples, network resources or borrowed melodies.
export class Soundscape{
 constructor(){this.ctx=null;this.mood='sea';this.settings={music:35,ambient:28,effects:40};this.tick=0;this.timer=null;this.muted=false;}
 async start(){
  if(!this.ctx){
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
   this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.65;this.master.connect(this.ctx.destination);
   this.music=this.ctx.createGain();this.music.connect(this.master);this.amb=this.ctx.createGain();this.amb.connect(this.master);this.fx=this.ctx.createGain();this.fx.connect(this.master);
   const b=this.ctx.createBuffer(1,this.ctx.sampleRate*5,this.ctx.sampleRate),d=b.getChannelData(0);let last=0;
   for(let i=0;i<d.length;i++){last=(last+Math.random()*.12-.06)/1.02;d[i]=last*3;}
   this.rain=this.ctx.createBufferSource();this.rain.buffer=b;this.rain.loop=true;
   const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=1500;this.rain.connect(f);f.connect(this.amb);this.rain.start();
   this.update(this.settings);this.timer=setInterval(()=>this.pulse(),1100);this.pulse();
  }
  if(this.ctx.state==='suspended')await this.ctx.resume();
 }
 update(s){this.settings=s;if(!this.ctx)return;const t=this.ctx.currentTime;this.music.gain.setTargetAtTime(s.music/100*.23,t,.15);this.amb.gain.setTargetAtTime(s.ambient/100*(this.mood==='hope'?.025:.11),t,.3);this.fx.gain.setTargetAtTime(s.effects/100*.35,t,.1);}
 setMood(m){if(this.mood===m)return;this.mood=m;this.tick=0;this.update(this.settings);}
 tone(freq,time,duration,volume,type='sine',dest=this.music){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+.025);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(dest);o.start(time);o.stop(time+duration+.05);o.onended=()=>{o.disconnect();g.disconnect();};}
 pulse(){if(!this.ctx||this.ctx.state!=='running'||this.muted)return;
  const seq={sea:[50,57,62,65,57,60,62,53],warm:[53,60,65,69,67,60,62,65],investigate:[50,57,60,62,53,60,57,64],unease:[50,57,58,64,53,58,57,61],dread:[38,50,51,57,41,48,50,51],sad:[53,60,62,65,57,60,58,55],hope:[53,60,65,69,67,72,69,65]}[this.mood]||[50,57,62,65];
  const n=seq[this.tick%seq.length],hz=440*2**((n-69)/12),t=this.ctx.currentTime;this.tone(hz,t,3.4,.7);this.tone(hz*2,t+.02,2,.13,'triangle');
  if(this.tick%4===0)this.tone(440*2**((seq[0]-81)/12),t,5,.4);this.tick++;
 }
 effect(kind='tap'){if(!this.ctx||this.muted)return;const t=this.ctx.currentTime;
  if(kind==='bell'){[0,.18,.38].forEach((d,i)=>this.tone(740+i*185,t+d,1,.22,'sine',this.fx));}
  else if(kind==='thunder'){this.tone(42,t,2,.55,'triangle',this.fx);this.tone(51,t+.1,1.8,.2,'sawtooth',this.fx);}
  else this.tone(kind==='choice'?520:700,t,.07,.08,'sine',this.fx);
 }
 async pause(){this.muted=true;if(this.ctx?.state==='running')await this.ctx.suspend();}
 async resume(){this.muted=false;if(this.ctx?.state==='suspended')await this.ctx.resume();}
}
