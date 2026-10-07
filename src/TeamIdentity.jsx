import React, {useEffect,useState} from 'react'
import {MapPin,Shield} from 'lucide-react'
import {CommissionerCodes} from './LeagueAccount.jsx'

export const teamLogo = (supabase,path) => path ? supabase.storage.from('ssl-team-logos').getPublicUrl(path).data.publicUrl : ''

export function OfficialTeams({teams,loading,message,supabase}) {
 return <><div className="page-heading"><span className="eyebrow dark">THE CLUBS</span><h1>SSL TEAMS</h1><p>Official team names, logos, and home locations.</p></div>{message&&<p className="inline-message" role="status">{message}</p>}{teams.length?<div className="official-team-grid">{teams.map(t=><article key={t.slot} className="panel official-team-card"><img src={teamLogo(supabase,t.logo_path)} alt={`${t.name} logo`}/><div><small>SLUGGERS SUPA LEAGUE</small><h2>{t.name}</h2><p><MapPin size={16} aria-hidden="true"/>{t.ssl_locations?.name || 'Home location'}</p></div></article>)}</div>:<div className="panel basic-panel"><div className="empty"><span className="empty-icon"><Shield size={28}/></span><h3>{loading?'LOADING TEAMS…':'NO TEAMS SUBMITTED YET'}</h3><p>Teams appear here when their GM or the commissioner submits a name, home location, and logo.</p></div></div>}</>
}

function HomeLocations({supabase,onChange}) {
 const [locations,setLocations]=useState([]),[editing,setEditing]=useState(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[active,setActive]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function load(){const r=await supabase.from('ssl_locations').select('*').order('name');if(r.error)setMessage(r.error.message);else setLocations(r.data||[])}
 useEffect(()=>{load()},[])
 function reset(){setEditing(null);setName('');setDescription('');setActive(true)}
 async function save(e){e.preventDefault();setBusy(true);setMessage('');try{const r=await supabase.rpc('save_ssl_location',{location:editing,location_name:name.trim(),location_description:description.trim(),is_active:active});if(r.error)throw r.error;reset();await load();await onChange();setMessage('Home location saved.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="panel identity-panel"><div className="section-title"><div><small>COMMISSIONER CONTROLS</small><h2>PICKABLE HOME LOCATIONS</h2></div></div><div className="identity-body"><p>Add Mario universe places that GMs can choose as their team’s home. Retired places stay attached to existing teams.</p><form className="identity-form" onSubmit={save}><label>LOCATION NAME<input required minLength={2} maxLength={80} placeholder="e.g. Delfino Plaza" value={name} onChange={e=>setName(e.target.value)}/></label><label>DESCRIPTION (OPTIONAL)<input maxLength={240} placeholder="A short description of the place" value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="identity-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Available for teams to select</label><div className="identity-actions"><button className="red-btn" disabled={busy}>{editing?'SAVE LOCATION':'ADD LOCATION'}</button>{editing&&<button type="button" className="outline-btn" disabled={busy} onClick={reset}>CANCEL EDIT</button>}</div></form><div className="location-list">{locations.length?locations.map(l=><div className="location-row" key={l.id}><MapPin size={20} aria-hidden="true"/><div><strong>{l.name}</strong>{l.description&&<p>{l.description}</p>}<small>{l.active?'AVAILABLE':'RETIRED'}</small></div><button className="outline-btn" disabled={busy} onClick={()=>{setEditing(l.id);setName(l.name);setDescription(l.description);setActive(l.active)}}>EDIT</button></div>):<p>No locations listed yet. Add the places your GMs can pick from.</p>}</div>{message&&<p className="inline-message" role="status">{message}</p>}</div></section>
}

export function TeamSetup({supabase,access,teams,onChange,onAccess}) {
 const commissioner=access.role==='commissioner'
 const [slot,setSlot]=useState(commissioner?1:access.slot),[name,setName]=useState(''),[location,setLocation]=useState(''),[locations,setLocations]=useState([]),[logoPath,setLogoPath]=useState(''),[file,setFile]=useState(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[fileKey,setFileKey]=useState(0)
 useEffect(()=>{let live=true;setLoading(true);setMessage('');setFile(null);setFileKey(k=>k+1);Promise.all([supabase.from('ssl_locations').select('*').order('name'),supabase.from('ssl_teams').select('*').eq('slot',slot).maybeSingle()]).then(([towns,team])=>{if(!live)return;if(towns.error||team.error)setMessage(towns.error?.message||team.error.message);else{setLocations(towns.data||[]);setName(team.data?.name||'');setLocation(team.data?.location_id||'');setLogoPath(team.data?.logo_path||'')}setLoading(false)});return()=>{live=false}},[slot])
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
   const r=await supabase.rpc('save_ssl_team',{target_slot:Number(slot),team_name:name.trim(),home_location:location,team_logo_path:path});if(r.error)throw r.error
   uploaded='';setLogoPath(path);setFile(null);setFileKey(k=>k+1);await onChange()
   const current=await supabase.rpc('league_session_access');if(current.data)onAccess(current.data)
   setMessage('Team submitted. Your name, logo, and home location are now live on the Teams tab.')
  }catch(e){if(uploaded)await supabase.storage.from('ssl-team-logos').remove([uploaded]);setMessage(e.message)}finally{setBusy(false)}
 }
 const eligible=locations.filter(l=>l.active||l.id===location)
 return <section className="panel identity-panel"><div className="section-title"><div><small>{commissioner?'COMMISSIONER CONTROLS':'GM CONTROLS'}</small><h2>{commissioner?'SET UP ANY TEAM':'YOUR TEAM IDENTITY'}</h2></div></div><div className="identity-body"><p>{commissioner?'Submit a team on behalf of its GM, or edit a registered team. Team slots match your GM permission codes.':'Choose your Mario universe home location, create your team name, and upload its logo. Submitting publishes it to the league site.'}</p>{commissioner&&<label className="identity-slot">TEAM SLOT<select value={slot} disabled={busy} onChange={e=>setSlot(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>GM Slot {i+1}{teams.find(t=>t.slot===i+1)?` — ${teams.find(t=>t.slot===i+1).name}`:''}</option>)}</select></label>}{loading?<p>Loading team setup…</p>:<form className="identity-form" onSubmit={submit}><label>HOME LOCATION<select required value={location} onChange={e=>setLocation(e.target.value)} disabled={busy}><option value="">Choose a Mario universe place</option>{eligible.map(l=><option key={l.id} value={l.id}>{l.name}{l.active?'':' (retired — current home)'}</option>)}</select></label>{!eligible.length&&<p className="setup-note">The commissioner needs to add pickable home locations first.</p>}<label>TEAM NAME<input required minLength={2} maxLength={80} placeholder="e.g. Delfino Plaza Pirates" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label>TEAM LOGO<input key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/><small>PNG, JPG, or WebP · up to 5 MB. Choose a new file to replace the current logo.</small></label>{preview&&<div className="identity-preview"><img src={preview} alt="Team logo preview"/><div><strong>{name||'Your team name'}</strong><p>{locations.find(l=>l.id===location)?.name||'Choose a home location'}</p></div></div>}<button className="red-btn" disabled={busy||!location||(!file&&!logoPath)}>{busy?'SUBMITTING…':'SUBMIT TEAM TO THE SITE'}</button></form>}{message&&<p className="inline-message" role="status">{message}</p>}</div></section>
}

export function CommissionerWorkspace({supabase,access,teams,onChange,onAccess}) {
 const [tab,setTab]=useState('Home Locations')
 return <><div className="subnav commissioner-tabs" role="tablist" aria-label="Commissioner tool sections">{['Home Locations','Team Setup','GM Codes'].map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>{tab==='Home Locations'?<HomeLocations supabase={supabase} onChange={onChange}/>:tab==='Team Setup'?<TeamSetup supabase={supabase} access={access} teams={teams} onChange={onChange} onAccess={onAccess}/>:<CommissionerCodes supabase={supabase} onAccess={onAccess}/>}</>
}
