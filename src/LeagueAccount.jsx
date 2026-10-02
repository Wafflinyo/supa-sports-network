import React, { useEffect, useState } from 'react'
import { X, CircleUserRound } from 'lucide-react'

export function AccountDialog({supabase,session,onClose,onAccess}) {
 const [mode,setMode]=useState('login')
 const [username,setUsername]=useState('')
 const [password,setPassword]=useState('')
 const [code,setCode]=useState('')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [access,setAccess]=useState({role:'participant'})
 useEffect(()=>{if(session&&supabase) supabase.rpc('league_session_access').then(r=>r.data&&setAccess(r.data))},[session?.user?.id])
 async function submit(e){
  e.preventDefault();setBusy(true);setMessage('')
  try {
   if(!supabase) throw new Error('Account setup is not connected yet.')
   if(!session){
    const response=await supabase.functions.invoke('league-auth',{body:{action:mode,username,password}})
    if(response.error || response.data?.error){
     let detail=response.data?.error
     if(!detail && response.error?.context){try{detail=(await response.error.context.json()).error}catch{}}
     throw new Error(detail||'Could not sign in. Please try again.')
    }
    const signed=await supabase.auth.setSession(response.data.session)
    if(signed.error) throw signed.error
    if(mode==='signup') setMode('login')
   }
   // Always clear prior elevated access before processing this login's optional code.
   const cleared=await supabase.rpc('leave_league_access')
   if(cleared.error) throw cleared.error
   let next={role:'participant'}
   if(code.trim()){
    const activated=await supabase.rpc('activate_league_access',{code:code.trim()})
    if(activated.error||activated.data?.error){
     if(!session) await supabase.auth.signOut()
     throw new Error(activated.data?.error||activated.error.message)
    }
    next=activated.data
   }
   onAccess(next); setPassword('');setCode('');onClose()
  }catch(error){if(!session&&supabase) await supabase.auth.signOut();setMessage(error.message)}finally{setBusy(false)}
 }
 return <div className="modal-backdrop" onClick={onClose}><div className="modal auth-modal" role="dialog" aria-modal="true" aria-label="League account" onClick={e=>e.stopPropagation()}>
  <button className="close" aria-label="Close" onClick={onClose}><X/></button><CircleUserRound size={34} color="#d9232e"/>
  <h2>{session?'YOUR ACCOUNT':mode==='signup'?'CREATE AN ACCOUNT':'SIGN IN TO THE LEAGUE'}</h2>
  {session?<p>Signed in as <strong>{session.user.email?.split('@')[0]}</strong>. Current access: <strong>{access.role}</strong>{access.team?` — ${access.team}`:''}.</p>:<><div className="stat-view-switch">{['login','signup'].map(m=><button key={m} className={mode===m?'active':''} onClick={()=>{setMode(m);setMessage('')}}>{m==='login'?'SIGN IN':'CREATE ACCOUNT'}</button>)}</div><p>No email required. Leave the code blank for fantasy participation.</p></>}
  <form onSubmit={submit}>
   {!session&&<><label htmlFor="account-username">USERNAME</label><input id="account-username" required pattern="[A-Za-z0-9_]{3,24}" minLength={3} maxLength={24} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="3–24 letters, numbers or underscores"/><label htmlFor="account-password">PASSWORD</label><input id="account-password" type="password" required minLength={10} maxLength={128} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></>}
   <label htmlFor="account-code">GM / COMMISSIONER CODE (OPTIONAL)</label><input id="account-code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="Leave blank for ordinary access"/>
   <button disabled={busy||!supabase} className="red-btn">{busy?'PLEASE WAIT…':session?'UPDATE SESSION ACCESS':mode==='signup'?'CREATE ACCOUNT':'SIGN IN'}</button>
  </form>
  {!session&&mode==='signup'&&<p className="setup-note">Keep your password safe. Email password recovery is not available for username-only accounts.</p>}
  {session&&<button className="outline-btn" onClick={async()=>{await supabase.rpc('leave_league_access');await supabase.auth.signOut();onAccess({role:'viewer'});onClose()}}>SIGN OUT</button>}
  {message&&<p className="inline-message" role="status">{message}</p>}
 </div></div>
}

export function CommissionerCodes({supabase,onAccess}){
 const [rows,setRows]=useState([]),[names,setNames]=useState({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[newCode,setNewCode]=useState(null)
 async function load(){const r=await supabase.rpc('league_code_list');if(r.error){setMessage(r.error.message);return}setRows(r.data||[]);setNames(Object.fromEntries((r.data||[]).map(x=>[x.slot,x.team||''])))}
 useEffect(()=>{load()},[])
 async function regenerate(row){
  setBusy(true);setMessage('');setNewCode(null)
  const r=await supabase.rpc('regenerate_gm_code',{target_slot:row.slot,team_label:names[row.slot]||''})
  setBusy(false)
  if(r.error){setMessage(r.error.message);if(r.error.message.includes('Commissioner')) onAccess({role:'participant'});return}
  setNewCode(r.data);await load()
 }
 return <section className="panel access-panel"><div className="section-title"><div><small>COMMISSIONER CONTROLS</small><h2>GM ACCESS CODES</h2></div></div><div className="access-content">
  <p>Assign each slot to one team. Creating or regenerating a code immediately invalidates its old code and removes GM access from every session using it. Their accounts and fantasy teams remain intact.</p>
  <p>New codes appear once here. Share a team's code privately with its GM; they may share it with their coaches. Each person uses their own account.</p>
  {newCode&&<div className="code-receipt" role="status"><strong>{newCode.team} — new code</strong><code>{newCode.code}</code><button className="outline-btn" onClick={()=>navigator.clipboard.writeText(newCode.code).then(()=>setMessage('Code copied.')).catch(()=>setMessage('Select the code above and copy it.'))}>COPY CODE</button><button className="text-link" onClick={()=>setNewCode(null)}>HIDE CODE</button></div>}
  <div className="gm-code-grid">{rows.map(row=><div key={row.slot} className="gm-code-row"><label htmlFor={`gm-slot-${row.slot}`}>GM SLOT {row.slot}</label><input id={`gm-slot-${row.slot}`} maxLength={80} value={names[row.slot]||''} onChange={e=>setNames({...names,[row.slot]:e.target.value})} placeholder="Official team name"/><span>{row.team?`Code version ${row.version}`:'Inactive — no team assigned'}</span><button className="outline-btn" disabled={busy||(names[row.slot]||'').trim().length<2} onClick={()=>regenerate(row)}>{row.team?'REGENERATE GM CODE':'CREATE GM CODE'}</button></div>)}</div>
  {message&&<p role="status" className="inline-message">{message}</p>}
 </div></section>
}
