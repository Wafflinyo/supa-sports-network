import React,{useEffect,useState} from 'react';

// The news cards and hero slides share one accessible disclosure. The complete
// article stays in the DOM only after the reader opts to expand it.
export default function HeadlineReadMore({text,id,limit=180,className=''}) {
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>setExpanded(false),[id]);
  const full=String(text||'');
  // Grouped stat articles have one self-contained reporter paragraph per player.
  // Retain semantic bullets and generous spacing on both desktop and mobile.
  if(full.startsWith('• ')){
    const [achievements,...context]=full.split(/\n\n/);
    const bullets=achievements.split('\n').filter(Boolean).map(line=>line.replace(/^•\s*/, ''));
    const closing=context.join('\n\n').trim();
    const cutoff=full.length>limit;
    const shown=expanded||!cutoff?bullets:bullets.slice(0,1);
    return <div className={'ssl-headline-story ssl-headline-bullets '+className+(expanded?' expanded':'')}>
      <ul style={{paddingLeft:'1.3em',margin:'0 0 .65em',lineHeight:1.55}}>
        {shown.map((line,index)=><li key={index} style={{marginBottom:'.95em'}}>{line}</li>)}
      </ul>
      {(expanded||!cutoff)&&closing&&<p style={{margin:'0'}}>{closing}</p>}
      {cutoff&&<button type="button" className="ssl-headline-expand"
        aria-expanded={expanded} aria-label={(expanded?'Show less':'Read the full story')+' for this headline'}
        onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'Show more'}</button>}
    </div>;
  }
  const cutoff=full.length>limit;
  const preview=cutoff?full.slice(0,limit).replace(/\s+\S*$/,'').trimEnd():full;
  return <div className={'ssl-headline-story '+className+(expanded?' expanded':'')}>
    <p>{expanded||!cutoff?full:preview+'…'}
      {cutoff&&<>{' '}<button type="button" className="ssl-headline-expand"
        aria-expanded={expanded} aria-label={(expanded?'Show less':'Read the full story')+' for this headline'}
        onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'more'}</button></>}
    </p>
  </div>;
}
