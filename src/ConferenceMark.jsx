import React from 'react'
export const conferenceInfo={
 supa:{name:'Supa Mario Conference',short:'SMC',image:'/conference-supa.svg'},
 galaxy:{name:'Mario Galaxy Conference',short:'MGC',image:'/conference-galaxy.svg'}
}
export function ConferenceMark({id,size=42}){
 const item=conferenceInfo[id]
 return item?<img className="conference-mark" src={import.meta.env.BASE_URL+item.image.slice(1)} width={size} height={size} alt={item.name+' logo'} style={{objectFit:'contain',flexShrink:0}}/>:null
}