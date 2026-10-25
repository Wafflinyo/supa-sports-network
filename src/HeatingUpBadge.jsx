import React, {createContext,useContext} from 'react';

// One provider shares the current Heating Up players across all player cards.
export const HeatingUpContext=createContext(new Set());
export function HeatingUpProvider({ids,children}) {
  return <HeatingUpContext.Provider value={ids}>{children}</HeatingUpContext.Provider>;
}
export function HeatFlame() { return <svg viewBox="0 0 28 33" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M14.6 1.8c1.7 6.6-3.8 8.3-3.5 13.2-2.4-1.8-3-4.7-2.6-7.4C2.3 14.4 2.7 20 5.3 25.8c1.7 3.8 4.8 5.4 8.7 5.4 6.9 0 11.5-5.2 11.4-11.7-.1-5.1-3-8.4-5.2-10.6.3 4.1-1 6.6-3 8.3-.3-4.7 2.4-8.1-2.6-15.1Z" fill="#f24b19" stroke="#742316" strokeWidth="1.8" strokeLinejoin="round"/><path d="M15.5 14.5c.7 4-2.9 5.4-2 8.4-2-1.2-2.3-2.4-2.4-4.7-2.6 3.1-2.2 8.1.8 10 1.3.9 2.7 1.3 4.2 1.3 4.3 0 6.8-3.3 6-7.3-.4-2.5-2.3-4.9-4.6-7.7Z" fill="#ffda47"/><path d="M13.8 21.5c-.7 2.2-2.6 2.9-2.1 5.5.3 1.6 1.3 2.4 2.7 2.4 2.2 0 3.5-1.5 3.3-3.8-.1-1.5-1.4-2.9-2.2-3.8-.1 1.4-.7 2.4-1.7 3-.5-.9-.4-2.3 0-3.3Z" fill="#fff7bc"/></svg>; }
export function HeatMark({playerId,inline=false}) {
  const hot=useContext(HeatingUpContext);
  if(!hot?.has(Number(playerId)))return null;
  return <span className={inline?'heat-mark heat-mark-inline':'heat-mark'} title="Heating Up · Game Score 90+ in latest game" aria-label="Heating Up">
    <HeatFlame/>
  </span>;
}
