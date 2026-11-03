import React,{useMemo,useState} from 'react';
import pool from './players.json';
import {previewCustomGameScore,automaticReportMvp} from './season-data.js';
import {readPreseasonRio,makePreseasonReport,preseasonDraftRosters,preseasonPreviewBox} from './preseason-rio-report.js';
import GameBoxScore from './GameBoxScore.jsx';

const byId=new Map(pool.map(p=>[Number(p.id),p.name]));
const round2=value=>Math.round((Number(value||0)+Number.EPSILON)*100)/100;
export default function PreseasonRioImport({league,game,onClose}){
  const [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [showBox,setShowBox]=useState(false);
  const roster=useMemo(()=>preseasonDraftRosters(league.season,game),[league.season,game]);
  const computed=useMemo(()=>{
    if(!preview)return null;
    try{return makePreseasonReport(preview,league.season,game,pool)}catch{return null}
  },[preview,league.season,game]);
  const autoMvp=useMemo(()=>{
    if(!preview)return null;
    try{return automaticReportMvp(preview,game.high.name)}catch{return null}
  },[preview,game.high.name]);
  const previewBox=useMemo(()=>computed?preseasonPreviewBox(league.season,game,computed):null,
    [computed,league.season,game]);
  const teamForRow=row=>row.label===game.high.name?String(game.high.id):String(game.low.id);
  return <div className="ssl-pre-rio-import" aria-label={'Commissioner Project Rio upload for '+game.key}>
    <h4>COMMISSIONER · PROJECT RIO GAME REPORT</h4>
    <p>Upload the finished <strong>.ods</strong> or <strong>.xlsx</strong> file.
      The in-game names are linked to your SSL teams automatically. The site scores batting,
      defense, pitching, Item Score and winning-team MVP, then lets you inspect the box score.
      Saving is private; releasing is a separate action.</p>
    <input type="file" accept=".ods,.xlsx" aria-label={game.key+' Project Rio ODS or XLSX file'}
      disabled={loading||league.busy} onChange={async event=>{
        const file=event.target.files?.[0];if(!file)return;
        setLoading(true);setError('');setPreview(null);setShowBox(false);
        try{setPreview(await readPreseasonRio(file,league.season,game,pool))}
        catch(e){setError(e.message)}finally{setLoading(false)}
        event.target.value='';
      }}/>
    {loading&&<p>Reading Project Rio report…</p>}
    {error&&<p className="ssl-pre-error" role="alert">{error}</p>}
    {preview&&<>
      <p><strong>Matched teams:</strong> {(preview.gameInfo||[]).join(' · ')}</p>
      <p><strong>Review game:</strong> {game.high.name} vs. {game.low.name}</p>
      <div className="ssl-pre-scroll">
        <table className="ssl-pre-rio-table">
          <thead><tr><th>Project Rio Player</th><th>SSL Team</th><th>Item</th><th>Calculated Game Points</th><th>Matched SSL Player</th></tr></thead>
          <tbody>{preview.rows.map((row,index)=>{
            const team=teamForRow(row);
            let score;
            try{score=previewCustomGameScore(preview,row,autoMvp).gameScore}catch{score=null}
            return <tr key={index}><td>{row.player}</td><td>{row.label}</td>
              <td>{row.itemscore===''?0:row.itemscore??0}</td>
              <td><strong>{score==null?'—':round2(score)}</strong></td>
              <td><select aria-label={game.key+' player row '+row.row} value={row.chosen}
                onChange={e=>setPreview(p=>({...p,rows:p.rows.map((x,i)=>i===index?{...x,chosen:Number(e.target.value)||''}:x)}))}>
                <option value="">Choose player</option>
                {(roster[team]||[]).map(id=><option key={id} value={id}>{byId.get(Number(id))||id}</option>)}
              </select></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <h5>PITCHING REPORT</h5>
      <div className="ssl-pre-scroll"><table className="ssl-pre-rio-table">
        <thead><tr><th>Pitcher</th><th>Team</th><th>IP</th><th>Strikes</th><th>K</th><th>ER</th><th>HR Allowed</th><th>Complete Game</th><th>SSL Player</th></tr></thead>
        <tbody>{preview.pitch.map((row,index)=>{
          const team=teamForRow(row);
          return <tr key={index}>
            <td>{row.player}</td><td>{row.label}</td><td>{row.inningspitched||0}</td>
            <td>{row.strikes||0}</td><td>{row.strikeouts||0}</td><td>{row.earnedruns||0}</td>
            <td>{row.hrallowed||0}</td>
            <td><input type="checkbox" checked={Number(row.completegames)===1}
              disabled={preview.pitch.filter(p=>p.label===row.label).length!==1}
              aria-label={game.key+' complete game '+row.player}
              onChange={e=>setPreview(p=>({...p,pitch:p.pitch.map((x,i)=>i===index?{...x,completegames:e.target.checked?1:0}:x)}))}/></td>
            <td><select aria-label={game.key+' pitcher row '+row.row} value={row.chosen}
              onChange={e=>setPreview(p=>({...p,pitch:p.pitch.map((x,i)=>i===index?{...x,chosen:Number(e.target.value)||''}:x)}))}>
              <option value="">Choose pitcher</option>
              {(roster[team]||[]).map(id=><option key={id} value={id}>{byId.get(Number(id))||id}</option>)}
            </select></td>
          </tr>
        })}</tbody>
      </table></div>
      <div className="ssl-pre-rio-summary">
        <strong>FINAL SCORE PREVIEW</strong>
        <p>{game.high.name}: <b>{computed?.scoreA??'—'}</b> · {game.low.name}: <b>{computed?.scoreB??'—'}</b></p>
        <p>Automatic MVP: <strong>{byId.get(Number(autoMvp))||'Map all players first'}</strong></p>
      </div>
      <div className="ssl-pre-rio-actions">
        <button className="outline-btn" type="button" disabled={!previewBox}
          onClick={()=>setShowBox(true)}>REVIEW FULL BOX SCORE / GAME POINTS</button>
        <button className="red-btn" type="button" disabled={!computed||league.busy}
          onClick={async()=>{try{if(await league.savePreseasonReport(game.key,computed))onClose?.()}
            catch(e){setError(e.message)}}}>
          SAVE PRIVATE REPORT · DO NOT RELEASE
        </button>
      </div>
      {!computed&&<p className="ssl-pre-help">All 18 participating players, all pitchers, team scores and the MVP must validate before saving.</p>}
    </>}
    {showBox&&previewBox&&<GameBoxScore game={previewBox} onClose={()=>setShowBox(false)}/>}
  </div>;
}
