import React, {useState} from 'react'
export const conferenceInfo={
 supa:{name:'Supa Mario Conference',short:'SMC',image:'/conference-supa.webp',fallback:'/conference-supa.svg'},
 galaxy:{name:'Mario Galaxy Conference',short:'MGC',image:'/conference-galaxy.webp',fallback:'/conference-galaxy.svg'}
}
export function ConferenceMark({id,size=42}){
 const [failed,setFailed]=useState(false)
 const item=conferenceInfo[id]
 if(!item)return null
 const asset = failed ? item.fallback : item.image
 return <img className="conference-mark" src={import.meta.env.BASE_URL+asset.slice(1)} width={size} height={size} onError={()=>setFailed(true)} alt={item.name+' logo'} style={{objectFit:'contain',flexShrink:0}}/>
}