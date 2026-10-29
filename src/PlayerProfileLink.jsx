import React,{createContext,useContext} from 'react';

// One career profile is owned by the top-level SSL app. Every player surface
// can request it without creating extra overlapping modal instances.
export const PlayerProfileContext=createContext(null);
export function usePlayerProfile(){
  return useContext(PlayerProfileContext);
}
export function PlayerProfileLink({player,children,className='',title}){
  const open=usePlayerProfile();
  if(!player)return <span>{children}</span>;
  return <button type="button" className={'ssl-player-profile-link '+className}
    aria-label={title||'View '+player.name+' career statistics'}
    onClick={()=>open?.(player)}>
    {children}
  </button>;
}
