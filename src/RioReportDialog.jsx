import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import './rio-report-dialog.css';

// A single full-screen review workspace for both regular-season and preseason
// uploads. Using a portal keeps large score tables out of narrow matchup cards.
export default function RioReportDialog({title,subtitle,onClose,children}){
  const panelRef=useRef(null);
  const closeButtonRef=useRef(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeButtonRef.current?.focus();
    const onKeyDown=event=>{
      // The full box score is a second, higher-priority dialog.
      if(document.querySelector('.ssl-box-backdrop'))return;
      if(event.key==='Escape'){
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if(event.key!=='Tab')return;
      const root=panelRef.current;
      if(!root)return;
      const elements=[...root.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )].filter(el=>el.getClientRects().length>0);
      if(!elements.length)return;
      const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    };
    document.addEventListener('keydown',onKeyDown);
    return ()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=oldOverflow;
      if(previous?.isConnected)previous.focus();
    };
  },[]);
  return createPortal(
    <div className="ssl-rio-dialog-backdrop" onMouseDown={event=>{
      if(event.target===event.currentTarget)onCloseRef.current?.();
    }}>
      <section className="ssl-rio-report-dialog" role="dialog" aria-modal="true"
        aria-label={title} ref={panelRef}>
        <header className="ssl-rio-dialog-header">
          <div><small>COMMISSIONER-ONLY · PRIVATE UNTIL RELEASE</small>
            <h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>
          <button type="button" className="ssl-rio-dialog-close" ref={closeButtonRef}
            onClick={()=>onCloseRef.current?.()} aria-label="Close game file uploader">×</button>
        </header>
        <div className="ssl-rio-dialog-content">{children}</div>
      </section>
    </div>,document.body
  );
}
