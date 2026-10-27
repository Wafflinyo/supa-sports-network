import React from 'react';
import {originalPlayerDraft} from './draft-pedigree.js';
import './draft-pedigree.css';

export function DraftPickBadge({playerId,seasons=[],compact=false}) {
  const draft=originalPlayerDraft(playerId,seasons);
  if(!draft)return null;
  return <span className={'draft-pedigree-tag'+(compact?' compact':'')}
    title={'Original SSL selection · Season '+draft.season+', Round '+draft.round+
      ', Overall Pick #'+draft.number+(draft.supplemental?' · Supplemental':'')}>
    <strong>ROUND {draft.round}</strong><span>PICK #{draft.number}</span>
    {draft.season>1&&<em>S{draft.season}</em>}
    {draft.supplemental&&<em>SUPPLEMENTAL</em>}
  </span>;
}
