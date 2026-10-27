import React from 'react';
import {originalPlayerDraft,isUndraftedSigning} from './draft-pedigree.js';
import './draft-pedigree.css';

export function DraftPickBadge({playerId,seasons=[],compact=false}) {
  const draft=originalPlayerDraft(playerId,seasons);
  if(!draft){
    if(!isUndraftedSigning(playerId,seasons))return null;
    return <span className={'draft-pedigree-tag undrafted'+(compact?' compact':'')}
      title="UNDRAFTED · Acquired without an official SSL draft pick">
      <strong>UNDRAFTED</strong>
    </span>;
  }
  return <span className={'draft-pedigree-tag'+(compact?' compact':'')}
    title={'Original SSL selection · Season '+draft.season+', Round '+draft.round+
      ', Overall Pick #'+draft.number+(draft.supplemental?' · Supplemental':'')}>
    <strong>ROUND {draft.round}</strong><span>PICK #{draft.number}</span>
    {draft.season>1&&<em>S{draft.season}</em>}
    {draft.supplemental&&<em>SUPPLEMENTAL</em>}
  </span>;
}
