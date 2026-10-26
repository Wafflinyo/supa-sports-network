import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BingoLottery} from '../src/BingoLottery.jsx';
import {lotteryProgress} from '../src/lottery-timing.js';
import '../src/season.css';
import '../src/bingo-lottery.css';
import './preview.css';
const EPOCH='2026-10-01T10:00:00.000Z';
function App(){
  const [stage,setStage]=useState(lotteryProgress(12,EPOCH,Date.parse(EPOCH)));
  window.__renderSample=(elapsed,progress)=>setStage(progress);
  const teams=window.__teams||[],order=window.__order||[];
  const shown=stage.phase==='rolling'?Math.max(0,stage.revealed-1):stage.revealed;
  return <main className="movie">
    <header className="movie-header">
      <div className="movie-eyebrow">SUPA SPORTS NETWORK · SEASON 1</div>
      <h1>SSL <em>DRAFT LOTTERY</em></h1>
      <p>12 FRANCHISES · 12 LOGO BALLS · OFFICIAL STYLE</p>
      <span className="movie-example">FULL-LENGTH SAMPLE — EXAMPLE ORDER, NOT THE OFFICIAL DRAW — SILENT</span>
    </header>
    <BingoLottery teams={teams} order={order} lottery={stage} logoFor={url=>url}/>
    <section className="movie-results">
      <div className="movie-results-head">LIVE DRAFT ORDER <span>{shown} / 12 REVEALED</span></div>
      <div className="movie-grid">
        {order.map((id,i)=>{
          const team=teams.find(t=>t.id===id),ready=i<shown;
          return <div className={'movie-result'+(ready?' is-drawn':'')} key={id}>
            <b>{String(i+1).padStart(2,'0')}</b>
            {ready&&team?<><img src={team.logoPath} alt=""/><span>{team.name}</span></>:<i>WAITING FOR DRAW</i>}
          </div>;
        })}
      </div>
    </section>
    <footer className="movie-bottom">10s MIX · 3.2s DOWNHILL ROLL · 5s ANNOUNCEMENT · NO AUDIO · SAMPLE ONLY</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);