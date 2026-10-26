import React,{useEffect,useState,useRef} from 'react';
import {BingoLottery} from './BingoLottery.jsx';
import {lotteryProgress,lotteryDuration} from './lottery-timing.js';
import {shuffleLotteryOrder,cryptoLotteryIndex} from './lottery-random.js';
import './bingo-lottery.css';
import './lottery-practice.css';

const NAME_PATH='https://vocaddalptoghysgdkvh.supabase.co/storage/v1/object/public/ssl-team-logos/';
const slots=[
  [1,'Delfino Dolphins','1/76fc9d22-ade5-4b0f-89b3-c23bcb055248.png'],
  [2,'HopeDogo Retrievers 3','2/f1b981d6-d38d-4633-a575-20cc4e547e8c.png'],
  [3,'Petalburg Petilils','3/f6a49cf7-ac71-4acb-9109-8a5f8bae826b.png'],
  [4,'Moleville Haliban','4/f40d2bb4-dc79-484c-8923-7a492c03d5f2.jpg'],
  [5,'Diamond City Checkers','5/96c5e34c-f328-4c17-98d7-9aeadae625b0.png'],
  [6,'Starborn Voidstriders','6/5a445db7-b910-43e2-9adf-6eef16d5a559.png'],
  [7,'New Donk City Knights','7/d775ab4f-5fe2-44d1-9445-24097700b9d7.jpg'],
  [8,'Petalburg Pangolins','8/6f891562-13fe-4028-b250-7db8662a3acb.jpg'],
  [9,'New Donk City Fuggetaboudits','9/13160e2b-3a52-4f33-9149-908a68af911f.png'],
  [10,'Rogueport Ruffians','10/47db7ba3-31f0-4923-b434-7b920a3d77ad.png'],
  [11,'TWILIGHT TOWN TANKS','11/c9d0548b-03b7-4eed-95f6-84e6f855391e.png'],
  [12,'Decalburg Dedennes','12/8ba4cb95-271c-42f2-8f63-0be56141b374.png'],
];
const TEAMS=slots.map(([id,name,logoPath])=>({id:String(id),name,logoPath:NAME_PATH+logoPath}));
function draw(){
  const order=shuffleLotteryOrder(TEAMS.map(t=>t.id),cryptoLotteryIndex);
  return {order,startedAt:Date.now(),runId:cryptoLotteryIndex(0x100000000)};
}
export default function LotteryPractice(){
  const [session,setSession]=useState(()=>draw());
  const [now,setNow]=useState(Date.now());
  const clockRef=useRef(null);
  useEffect(()=>{
    clockRef.current=setInterval(()=>setNow(Date.now()),75);
    return()=>clearInterval(clockRef.current);
  },[]);
  function redraw(){
    setSession(draw());setNow(Date.now());
  }
  const elapsed=Math.max(0,now-session.startedAt);
  const lottery=lotteryProgress(session.order.length,new Date(session.startedAt).toISOString(),session.startedAt+elapsed);
  const shown=lottery.phase==='rolling'?Math.max(0,lottery.revealed-1):lottery.revealed;
  return <main className="ssl-practice-page">
    <header className="ssl-practice-head">
      <a href="./">← SUPA SPORTS NETWORK</a>
      <div className="ssl-practice-kicker">LIVE INTERACTIVE DEMONSTRATION · NO ACTUAL LEAGUE PICKS</div>
      <h1>SSL <span>DRAFT LOTTERY</span></h1>
      <p>Each new demonstration shuffles all 12 balls with independent, equal chances. Results are saved only for this practice run; the official league draft is untouched.</p>
      <div className="ssl-practice-controls">
        <button type="button" onClick={redraw}>↻ NEW RANDOM LOTTERY</button>
        <span className="ssl-practice-odds">FIRST BALL: 1 / 12 = 8.3333%</span>
      </div>
    </header>
    <BingoLottery key={session.runId} teams={TEAMS} order={session.order} lottery={lottery} logoFor={p=>p}/>
    <section className="ssl-practice-table">
      <h2>Practice draw order <span>{shown} / 12 revealed</span></h2>
      <div className="ssl-practice-list">
        {Array.from({length:12},(_,i)=>{
          const team=TEAMS.find(t=>t.id===session.order[i]);
          const visible=i<shown;
          return <div key={i} className={visible?'ssl-practice-result picked':'ssl-practice-result'}>
            <b>{String(i+1).padStart(2,'0')}</b>
            {visible&&team?<><img src={team.logoPath} alt=""/><strong>{team.name}</strong></>:<span>AWAITING DRAW</span>}
          </div>;
        })}
      </div>
      <p className="ssl-practice-foot">Random selection is without replacement. On the first draw each team has 8.3333%; on the second each remaining team has 9.0909%; after that, 10%, 11.1111%, and so on. A recorded video always replays its original order; use <strong>NEW RANDOM LOTTERY</strong> to get new results.</p>
    </section>
  </main>;
}
