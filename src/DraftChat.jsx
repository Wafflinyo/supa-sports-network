import React, {useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,RefreshCw,LockKeyhole,Users} from 'lucide-react';
import './draft-chat.css';

/** Persistent commissioner / GM chat for a specific draft season.
 * Server RPCs independently verify role and franchise-code login.
 * Read is polled every 3.5 seconds so late joiners see the same history.
 */
export default function DraftChat({supabase,season,access}){
  const [messages,setMessages]=useState([]);
  const [draft,setDraft]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const [newActivity,setNewActivity]=useState(false);
  const viewport=useRef(null),bottom=useRef(null),lastId=useRef(0),busy=useRef(false),mounted=useRef(true);
  const canChat=['gm','commissioner'].includes(access?.role);
  const canRead=canChat && Boolean(supabase&&season?.id);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  useEffect(()=>{
    if(!canRead)return;
    setMessages([]);lastId.current=0;setLoading(true);setError('');
    let active=true;
    async function refresh(){
      if(busy.current||!active||document.visibilityState==='hidden')return;
      busy.current=true;
      try{
        const response=await supabase.rpc('ssl_draft_chat_read',{target_season:season.id});
        if(!active)return;
        if(response.error)throw response.error;
        const list=Array.isArray(response.data)?response.data:[];
        const end=viewport.current;
        const nearBottom=!end||end.scrollHeight-end.scrollTop-end.clientHeight<95;
        const nextId=Number(list[list.length-1]?.id||0);
        if(nextId>lastId.current&&lastId.current!==0&&!nearBottom)setNewActivity(true);
        lastId.current=nextId;
        setMessages(list);
        setError('');
        if(nearBottom)requestAnimationFrame(()=>{if(active)bottom.current?.scrollIntoView({block:'end',behavior:'instant'});});
      }catch(e){if(active)setError(e.message||'Unable to load draft chat.');}
      finally{if(active)setLoading(false);busy.current=false;}
    }
    refresh();
    const timer=setInterval(refresh,3500);
    const onFocus=()=>refresh();
    document.addEventListener('visibilitychange',onFocus);
    window.addEventListener('focus',onFocus);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('focus',onFocus);};
  },[canRead,season?.id,supabase]);
  async function send(e){
    e.preventDefault();
    const text=draft.trim();
    if(!text||sending||!canRead)return;
    setSending(true);setError('');
    const response=await supabase.rpc('ssl_draft_chat_send',{target_season:season.id,message_text:text});
    if(response.error){setError(response.error.message);}
    else{
      setDraft('');
      const read=await supabase.rpc('ssl_draft_chat_read',{target_season:season.id});
      if(!read.error&&Array.isArray(read.data)){
        setMessages(read.data);
        lastId.current=Number(read.data[read.data.length-1]?.id||0);
        requestAnimationFrame(()=>bottom.current?.scrollIntoView({block:'end',behavior:'smooth'}));
      }
    }
    setSending(false);
  }
  if(!canChat) {
    return <section className="ssl-chat-locked">
      <LockKeyhole size={18}/> Draft Room chat is available to signed-in GMs and the commissioner.
    </section>;
  }
  return <section className="ssl-draft-chat" aria-label="Live commissioner and GM draft chat">
    <div className="ssl-chat-header">
      <div><span className="ssl-chat-eyebrow"><Users size={14}/> COMMISSIONER + 12 GMS</span>
        <h2><MessageCircle size={22}/> DRAFT ROOM CHAT</h2>
        <p>Talk trades, picks and draft strategy. Messages stay here when you leave and return.</p>
      </div>
      <span className="ssl-chat-status"><span/> LIVE CHAT</span>
    </div>
    <div className="ssl-chat-messages" ref={viewport} role="log" aria-label="Draft chat messages" aria-live="off">
      {loading&&<p className="ssl-chat-empty">Loading draft conversation…</p>}
      {!loading&&!messages.length&&<p className="ssl-chat-empty">No messages yet. Start the conversation!</p>}
      {messages.map(m=><div key={m.id} className={'ssl-chat-message'+(m.isMine?' ssl-chat-mine':'')}>
        <div className="ssl-chat-avatar" aria-hidden="true">{m.slot===0?'C':String(m.teamName||'G').slice(0,1).toUpperCase()}</div>
        <div className="ssl-chat-bubble">
          <div className="ssl-chat-author"><strong>{m.username||'GM'}</strong>
            <span>{m.slot===0?'COMMISSIONER':m.teamName}</span>
            <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString()}>{new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(m.createdAt))}</time>
          </div>
          <div className="ssl-chat-body">{m.content}</div>
        </div>
      </div>)}
      <div ref={bottom} />
    </div>
    {newActivity&&<button className="ssl-chat-new" type="button" onClick={()=>{setNewActivity(false);bottom.current?.scrollIntoView({behavior:'smooth'});}}>
      <RefreshCw size={14}/> New messages · Jump to latest
    </button>}
    {error&&<p className="ssl-chat-error" role="alert">{error}</p>}
    <form className="ssl-chat-compose" onSubmit={send}>
      <label htmlFor="ssl-chat-input" className="sr-only">Message to all GMs</label>
      <input id="ssl-chat-input" value={draft} maxLength={280} onChange={e=>setDraft(e.target.value)}
        placeholder="Message the commissioner and other GMs…" autoComplete="off" aria-label="Draft Room message" />
      <small>{draft.length}/280</small>
      <button type="submit" disabled={sending||!draft.trim()}><Send size={17}/>{sending?'Sending…':'SEND'}</button>
    </form>
    <div className="ssl-chat-footer"><LockKeyhole size={13}/> GM-only conversation · Automatic refresh · Saved for reentry</div>
  </section>;
}
