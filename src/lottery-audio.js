// SSL lottery audio: separate, independently mixed music and physical marble effects.
// The game-show score is original, synthesized locally with Web Audio;
// no autoplay, streaming, third-party sounds or licensing dependencies.
const BPM = 124;
const HALF_BEAT = 60 / BPM / 2;
const MELODY = [
  [76,79,83,79, 76,79,84,79, 76,79,83,79, 74,79,83,79],
  [74,79,83,79, 74,79,86,79, 74,79,83,79, 71,79,83,79],
  [76,81,84,81, 76,81,88,81, 76,81,84,81, 72,81,84,81],
  [74,79,86,79, 74,79,83,79, 74,79,86,79, 71,79,83,79],
];
const ROOTS = [48,43,45,43];
const CHORDS = [[60,64,67],[55,59,62],[57,60,64],[55,59,62]];
const midi = n => 440 * Math.pow(2,(n-69)/12);
const release = (g,t,peak,attack,decay) => {
  g.gain.setValueAtTime(.0001,t);
  g.gain.linearRampToValueAtTime(Math.max(.0001,peak),t+attack);
  g.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);
};
export class LotteryAudio {
  constructor(ctx){
    this.ctx=ctx;
    this.musicBus=ctx.createGain();this.musicBus.gain.value=.46;this.musicBus.connect(ctx.destination);
    this.effectsBus=ctx.createGain();this.effectsBus.gain.value=.67;this.effectsBus.connect(ctx.destination);
    this.cursor=0;this.nextNoteAt=0;this.interval=null;this.lastCollision=-1000;
    this.rollStops=new Set();this.rollSources=new Set();this.running=false;
  }
  setVolumes({music=.46,effects=.67,musicMuted=false,effectsMuted=false}={}){
    const t=this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(musicMuted?0:music,t,.025);
    this.effectsBus.gain.setTargetAtTime(effectsMuted?0:effects,t,.025);
  }
  buffer(seconds){
    const length=Math.floor(this.ctx.sampleRate*seconds);
    const result=this.ctx.createBuffer(1,length,this.ctx.sampleRate);
    const a=result.getChannelData(0);
    let previous=0;
    for(let i=0;i<length;i++){
      previous=previous*.68+(Math.random()*2-1)*.32;
      a[i]=previous;
    }
    return result;
  }
  tone(freq,t,duration,peak=.11,type='sine',dest=this.musicBus){
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    release(g,t,peak,.007,Math.max(.04,duration));
    o.connect(g);g.connect(dest);
    o.start(t);o.stop(t+duration+.06);
    return o;
  }
  pluck(freq,t,vol=.12){
    // Bright marimba/vibraphone game-show lead: rounded fundamental plus
    // a brief slightly inharmonic overtone, much less harsh than square waves.
    this.tone(freq,t,.18,vol,'sine');
    this.tone(freq*2.02,t,.075,vol*.28,'triangle');
    this.tone(freq*.5,t,.16,vol*.19,'triangle');
  }
  kick(t){
    const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(112,t);o.frequency.exponentialRampToValueAtTime(51,t+.115);
    release(g,t,.24,.002,.14);
    o.connect(g);g.connect(this.musicBus);o.start(t);o.stop(t+.17);
  }
  snare(t){
    const ctx=this.ctx,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    src.buffer=this.buffer(.14);filter.type='highpass';filter.frequency.value=950;
    release(gain,t,.13,.002,.11);
    src.connect(filter);filter.connect(gain);gain.connect(this.musicBus);
    src.start(t);src.stop(t+.14);
    this.tone(185,t,.075,.055,'triangle');
  }
  hat(t,volume=.07){
    const ctx=this.ctx,src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    src.buffer=this.buffer(.07);filter.type='highpass';filter.frequency.value=5900;
    release(gain,t,volume,.001,.045);
    src.connect(filter);filter.connect(gain);gain.connect(this.musicBus);
    src.start(t);src.stop(t+.07);
  }
  playStep(t,step){
    const beat=step%8,bar=Math.floor(step/8)%4;
    if(beat%2===0) {
      if(beat===0||beat===4) this.kick(t);
      if(beat===2||beat===6) this.snare(t);
      this.hat(t,.06);
      this.tone(midi(ROOTS[bar] - (beat===4?0:0)),t,.22,.095,'triangle');
    } else this.hat(t,.085);
    const note=MELODY[bar][step%8+(Math.floor(step/16)%2?8:0)];
    if(beat!==1 || (step%16)>7)this.pluck(midi(note),t,.12);
    if(beat===0||beat===5) {
      for(const v of CHORDS[bar]) this.tone(midi(v),t,.30,.024,'sine');
    }
  }
  startMusic(){
    if(this.running)return;
    this.running=true;
    this.nextNoteAt=this.ctx.currentTime+.08;this.cursor=0;
    const schedule=()=>{
      if(!this.running)return;
      while(this.nextNoteAt<this.ctx.currentTime+.23){
        this.playStep(this.nextNoteAt,this.cursor);
        this.cursor++;
        this.nextNoteAt+=HALF_BEAT;
      }
    };
    schedule();
    this.interval=setInterval(schedule,80);
  }
  stopMusic(){
    this.running=false;clearInterval(this.interval);this.interval=null;
  }
  marbleClink(strength=.4){
    const ctx=this.ctx,t=ctx.currentTime;
    if(t-this.lastCollision<.055)return;
    this.lastCollision=t;
    const v=Math.min(1,Math.max(.1,strength));
    const freq=1280+Math.random()*950;
    const resonances=[[1,.092,.075],[1.91,.061,.055],[2.84,.042,.03]];
    // Multiple short, inharmonic resonances create a glass/marble clink,
    // followed by a very subtle wooden cage contact.
    for(const [ratio,decay,amp] of resonances){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.value=freq*ratio;
      release(g,t,amp*v,.0012,decay);
      o.connect(g);g.connect(this.effectsBus);o.start(t);o.stop(t+decay+.015);
    }
    const wood=ctx.createOscillator(),g=ctx.createGain();
    wood.type='triangle';wood.frequency.setValueAtTime(390,t);
    wood.frequency.exponentialRampToValueAtTime(260,t+.048);
    release(g,t,.02*v,.001,.052);
    wood.connect(g);g.connect(this.effectsBus);wood.start(t);wood.stop(t+.07);
  }
  rollingOnWood(phaseElapsed=0,fullMs=3200){
    const ctx=this.ctx,now=ctx.currentTime,duration=Math.max(.15,(fullMs-phaseElapsed)/1000);
    const rumble=ctx.createBufferSource(),low=ctx.createBiquadFilter(),gain=ctx.createGain();
    rumble.buffer=this.buffer(.34);rumble.loop=true;
    low.type='bandpass';low.frequency.value=410;low.Q.value=.64;
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(.12,now+.10);
    gain.gain.linearRampToValueAtTime(.078,now+duration*.6);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    rumble.connect(low);low.connect(gain);gain.connect(this.effectsBus);
    rumble.start(now);rumble.stop(now+duration+.015);
    this.rollSources.add(rumble);
    rumble.onended=()=>this.rollSources.delete(rumble);
    // Minute wooden-table vibrations and a definitive marble settling click.
    for(let i=0;i<Math.floor(duration/.23);i++){
      const t=now+.14+i*.23;
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.setValueAtTime(420-i*7,t);
      release(g,t,.013,.001,.03);
      o.connect(g);g.connect(this.effectsBus);o.start(t);o.stop(t+.045);
    }
    const settle=now+duration-.02;
    for(const [ratio,amp] of [[1,.11],[2.04,.045]]){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.value=1030*ratio;
      release(g,settle,amp,.002,.15);
      o.connect(g);g.connect(this.effectsBus);o.start(settle);o.stop(settle+.17);
    }
  }
  close(){
    this.stopMusic();
    for(const source of this.rollSources){try{source.stop();}catch{}}
    this.rollSources.clear();
    this.ctx.close().catch(()=>{});
  }
}
