import React, {useEffect,useState} from 'react'
import {MapPin,Shield} from 'lucide-react'
import {CommissionerCodes} from './LeagueAccount.jsx'

import {ConferenceMark,conferenceInfo} from './ConferenceMark.jsx'

export const teamLogo = (supabase,path) => path ? supabase.storage.from('ssl-team-logos').getPublicUrl(path).data.publicUrl : ''

export function OfficialTeams({teams,loading,message,supabase}) {
 return <><div className="page-heading"><span className="eyebrow dark">THE CLUBS</span><h1>SSL TEAMS</h1><p>Official team names, logos, and home locations.</p></div>{message&&<p className="inline-message" role="status">{message}</p>}{teams.length?<div className="official-team-grid">{teams.map(t=><article key={t.slot} className="panel official-team-card"><img src={teamLogo(supabase,t.logo_path)} alt={`${t.name} logo`}/><div className="official-team-details"><h2>{t.name}</h2><div className="official-team-meta"><span className="official-team-location"><MapPin size={16} aria-hidden="true"/><span>{t.ssl_locations?.name || 'Home location'}</span></span><span className={`official-team-conference ${t.conference==='galaxy'?'galaxy':t.conference==='supa'?'supa':'pending'}`}>{t.conference&&<ConferenceMark id={t.conference} size={20}/>}<span>{t.conference==='galaxy'?'Galaxy Conference':t.conference==='supa'?'Supa Conference':'Conference pending'}</span></span></div></div></article>)}</div>:<div className="panel basic-panel"><div className="empty"><span className="empty-icon"><Shield size={28}/></span><h3>{loading?'LOADING TEAMS…':'NO TEAMS SUBMITTED YET'}</h3><p>Teams appear here when their GM or the commissioner submits a name, home location, and logo.</p></div></div>}</>
}

function HomeLocations({supabase,onChange}) {
 const [locations,setLocations]=useState([]),[editing,setEditing]=useState(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[active,setActive]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function load(){const r=await supabase.from('ssl_locations').select('*').order('name');if(r.error)setMessage(r.error.message);else setLocations(r.data||[])}
 useEffect(()=>{load()},[])
 function reset(){setEditing(null);setName('');setDescription('');setActive(true)}
 async function save(e){e.preventDefault();setBusy(true);setMessage('');try{const r=await supabase.rpc('save_ssl_location',{location:editing,location_name:name.trim(),location_description:description.trim(),is_active:active});if(r.error)throw r.error;reset();await load();await onChange();setMessage('Home location saved.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="panel identity-panel"><div className="section-title"><div><small>COMMISSIONER CONTROLS</small><h2>PICKABLE HOME LOCATIONS</h2></div></div><div className="identity-body"><p>Add Mario universe places that GMs can choose as their team’s home. Retired places stay attached to existing teams.</p><form className="identity-form" onSubmit={save}><label>LOCATION NAME<input required minLength={2} maxLength={80} placeholder="e.g. Delfino Plaza" value={name} onChange={e=>setName(e.target.value)}/></label><label>DESCRIPTION (OPTIONAL)<input maxLength={240} placeholder="A short description of the place" value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="identity-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Available for teams to select</label><div className="identity-actions"><button className="red-btn" disabled={busy}>{editing?'SAVE LOCATION':'ADD LOCATION'}</button>{editing&&<button type="button" className="outline-btn" disabled={busy} onClick={reset}>CANCEL EDIT</button>}</div></form><div className="location-list">{locations.length?locations.map(l=><div className="location-row" key={l.id}><MapPin size={20} aria-hidden="true"/><div><strong>{l.name}</strong>{l.description&&<p>{l.description}</p>}<small>{l.active?'AVAILABLE':'RETIRED'}</small></div><button className="outline-btn" disabled={busy} onClick={()=>{setEditing(l.id);setName(l.name);setDescription(l.description);setActive(l.active)}}>EDIT</button></div>):<p>No locations listed yet. Add the places your GMs can pick from.</p>}</div>{message&&<p className="inline-message" role="status">{message}</p>}</div></section>
}

export function TeamSetup({supabase,access,teams,onChange,onAccess,initialSlot=1,lockedSlot=false}) {
 const commissioner=access.role==='commissioner'
 const [slot,setSlot]=useState(commissioner?initialSlot:access.slot),[name,setName]=useState(''),[location,setLocation]=useState(''),[conference,setConference]=useState(''),[locations,setLocations]=useState([]),[logoPath,setLogoPath]=useState(''),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[fileKey,setFileKey]=useState(0)
 useEffect(()=>{let live=true;setLoading(true);setMessage('');setFile(null);setFileKey(k=>k+1);Promise.all([supabase.from('ssl_locations').select('*').order('name'),supabase.from('ssl_teams').select('*').eq('slot',slot).maybeSingle()]).then(([towns,team])=>{if(!live)return;if(towns.error||team.error)setMessage(towns.error?.message||team.error.message);else{setLocations(towns.data||[]);setName(team.data?.name||'');setLocation(team.data?.location_id||'');setConference(team.data?.conference||'');setLogoPath(team.data?.logo_path||'')}setLoading(false)});return()=>{live=false}},[slot])
 useEffect(()=>{if(!file){setPreview(teamLogo(supabase,logoPath));return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file,logoPath])
 async function submit(e){
  e.preventDefault();setBusy(true);setMessage('');let uploaded=''
  try {
   let path=logoPath
   if(file){
    const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type]
    if(!ext||file.size>5242880||file.size===0)throw new Error('Choose a PNG, JPG, or WebP logo up to 5 MB.')
    const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('This file could not be read as an image.')})
    const oversized=bitmap.width>8192||bitmap.height>8192;bitmap.close();if(oversized)throw new Error('Use a logo no larger than 8192 pixels on either side.')
    path=`${slot}/${crypto.randomUUID()}.${ext}`
    const r=await supabase.storage.from('ssl-team-logos').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});if(r.error)throw r.error;uploaded=path
   }
   if(!path)throw new Error('Upload a team logo before submitting.')
   const r=await supabase.rpc('save_ssl_team',{target_slot:Number(slot),team_name:name.trim(),home_location:location,team_logo_path:path,chosen_conference:selectedConference});if(r.error)throw r.error
   uploaded='';setLogoPath(path);setFile(null);setFileKey(k=>k+1);await onChange()
   const current=await supabase.rpc('league_session_access');if(current.data)onAccess(current.data)
   setMessage(lockedSlot?'Team changes saved. Updated details are now live on the Teams tab.':'Team submitted. Your name, logo, and home location are now live on the Teams tab.')
  }catch(e){if(uploaded)await supabase.storage.from('ssl-team-logos').remove([uploaded]);setMessage(e.message)}finally{setBusy(false)}
 }
 // The slot being edited does not use up another spot in its own conference.
 const spots=Object.keys(conferenceInfo).map(k=>({key:k,count:teams.filter(t=>t.conference===k&&t.slot!==Number(slot)).length}));
 const openSpots=spots.filter(s=>s.count<6);
 // When one conference fills, GM registration automatically uses the remaining
 // conference. Derive the selection rather than relying on an async state update,
 // so the visible choice and the server RPC always agree.
 const automaticConference=!commissioner&&openSpots.length===1?openSpots[0].key:'';
 const selectedConference=automaticConference||(openSpots.some(s=>s.key===conference)?conference:'');
 const conferenceLocked=!commissioner&&openSpots.length===1;
 const filledConference=spots.find(s=>s.count>=6);
 const selectedSpot=spots.find(s=>s.key===selectedConference);
 const eligible=locations.filter(l=>l.active||l.id===location)
 return <section className="panel identity-panel"><div className="section-title"><div><small>{commissioner?'COMMISSIONER CONTROLS':'GM CONTROLS'}</small><h2>{commissioner?(lockedSlot?'EDIT REGISTERED TEAM':'SET UP ANY TEAM'):'YOUR TEAM IDENTITY'}</h2></div></div><div className="identity-body"><p>{commissioner?'Create or edit a franchise. You can update its name, home location, conference (when league rules permit), and logo without changing the GM slot.':'Choose your Mario universe home location, create your team name, and upload its logo. Submitting publishes it to the league site.'}</p>{commissioner&&!lockedSlot&&<label className="identity-slot">TEAM SLOT<select value={slot} disabled={busy} onChange={e=>setSlot(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>GM Slot {i+1}{teams.find(t=>t.slot===i+1)?` — ${teams.find(t=>t.slot===i+1).name}`:''}</option>)}</select></label>}{loading?<p>Loading team setup…</p>:<form className="identity-form" onSubmit={submit}><label>HOME LOCATION<select required value={location} onChange={e=>setLocation(e.target.value)} disabled={busy}><option value="">Choose a Mario universe place</option>{eligible.map(l=><option key={l.id} value={l.id}>{l.name}{l.active?'':' (retired — current home)'}</option>)}</select></label>{!eligible.length&&<p className="setup-note">The commissioner needs to add pickable home locations first.</p>}<label>CONFERENCE<select required value={selectedConference} disabled={busy||conferenceLocked||openSpots.length===0} onChange={e=>setConference(e.target.value)}><option value="">Choose your conference</option>{spots.map(({key,count})=><option key={key} value={key} disabled={count>=6}>{conferenceInfo[key].name} — {Math.max(0,6-count)} of 6 spots available{count>=6?" (FULL)":""}</option>)}</select><small>{openSpots.length===0?'Both conferences are full (6/6). No team slots are available.':conferenceLocked?(`${conferenceInfo[filledConference.key].name} is full (6/6). ${conferenceInfo[selectedConference].name} has been selected automatically and cannot be changed.`):'Each conference is limited to six teams. A full conference cannot accept more teams.'}</small></label>{selectedConference&&<div className="conference-pick"><ConferenceMark id={selectedConference} size={64}/><strong>{conferenceInfo[selectedConference].name}</strong><span>{6-(selectedSpot?.count||0)} spots available</span></div>}<label>TEAM NAME<input required minLength={2} maxLength={80} placeholder="e.g. Delfino Plaza Pirates" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label>TEAM LOGO<input key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/><small>PNG, JPG, or WebP · up to 5 MB. Choose a new file to replace the current logo.</small></label>{preview&&<div className="identity-preview"><img src={preview} alt="Team logo preview"/><div><strong>{name||'Your team name'}</strong><p>{locations.find(l=>l.id===location)?.name||'Choose a home location'}</p></div></div>}<button className="red-btn" disabled={busy||!location||!selectedConference||!selectedSpot||selectedSpot.count>=6||(!file&&!logoPath)}>{busy?'SAVING…':lockedSlot?'SAVE TEAM CHANGES':'SUBMIT TEAM TO THE SITE'}</button></form>}{message&&<p className="inline-message" role="status">{message}</p>}</div></section>
}

function CommissionerTeamEditor({supabase,access,teams,onChange,onAccess}) {
 const [selectedSlot,setSelectedSlot]=useState(null)
 useEffect(()=>{if(selectedSlot!==null)document.getElementById('commissioner-team-editor')?.scrollIntoView({behavior:'smooth',block:'start'})},[selectedSlot])
 const registered=[...teams].sort((a,b)=>a.slot-b.slot)
 return <>
  <section className="panel identity-panel">
   <div className="section-title"><div><small>COMMISSIONER CONTROLS</small><h2>EDIT REGISTERED TEAMS</h2></div></div>
   <div className="identity-body">
    <p>Select any franchise to change its name, logo, Mario-universe home location or eligible conference. Multiple clubs may share a home location. All existing GM slots and team history are preserved.</p>
    {registered.length?<div className="official-team-grid">{registered.map(t=><article className="panel official-team-card" key={t.slot}>
     <img src={teamLogo(supabase,t.logo_path)} alt={`${t.name} logo`}/>
     <div className="official-team-details"><small>GM SLOT {t.slot}</small><h2>{t.name}</h2>
      <p className="official-team-location"><MapPin size={16} aria-hidden="true"/>{t.ssl_locations?.name||'Home location'}</p>
      <p className="setup-note">{conferenceInfo[t.conference]?.name||'Conference pending'}</p>
      <button className="outline-btn" type="button" aria-label={`Edit ${t.name}`} onClick={()=>setSelectedSlot(t.slot)}>EDIT TEAM</button>
     </div>
    </article>)}</div>:<p>No registered teams yet. Use Team Setup to register a franchise.</p>}
   </div>
  </section>
  {selectedSlot!==null&&<div id="commissioner-team-editor">
   <div className="identity-actions"><button className="outline-btn" type="button" onClick={()=>setSelectedSlot(null)}>CLOSE EDITOR</button><strong>Editing GM Slot {selectedSlot}</strong></div>
   <TeamSetup key={selectedSlot} initialSlot={selectedSlot} lockedSlot supabase={supabase} access={access} teams={teams} onChange={onChange} onAccess={onAccess}/>
  </div>}
 </>
}

export function CommissionerWorkspace({supabase,access,teams,onChange,onAccess}) {
 const [tab,setTab]=useState('Edit Teams')
 return <><div className="subnav commissioner-tabs" role="tablist" aria-label="Commissioner tool sections">{['Edit Teams','Home Locations','Team Setup','GM Codes'].map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>{tab==='Edit Teams'?<CommissionerTeamEditor supabase={supabase} access={access} teams={teams} onChange={onChange} onAccess={onAccess}/>:tab==='Home Locations'?<HomeLocations supabase={supabase} onChange={onChange}/>:tab==='Team Setup'?<TeamSetup supabase={supabase} access={access} teams={teams} onChange={onChange} onAccess={onAccess}/>:<CommissionerCodes supabase={supabase} onAccess={onAccess}/>}</>
}
