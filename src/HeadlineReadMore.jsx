import React,{useEffect,useState} from 'react';

// The news cards and hero slides share one accessible disclosure. The complete
// article stays in the DOM only after the reader opts to expand it.
export default function HeadlineReadMore({text,id,limit=180,className=''}) {
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>setExpanded(false),[id]);
  const full=String(text||'');
  const cutoff=full.length>limit;
  const preview=cutoff?full.slice(0,limit).replace(/\s+\S*$/,'').trimEnd():full;
  return <div className={'ssl-headline-story '+className}>
    <p>{expanded||!cutoff?full:preview+'…'}
      {cutoff&&<>{' '}<button type="button" className="ssl-headline-expand"
        aria-expanded={expanded} aria-label={(expanded?'Show less':'Read the full story')+' for this headline'}
        onClick={()=>setExpanded(v=>!v)}>{expanded?'Show less':'more'}</button></>}
    </p>
  </div>;
}
