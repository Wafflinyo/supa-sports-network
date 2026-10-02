import { createClient } from 'npm:@supabase/supabase-js@2.58.0'
const site = 'https://wafflinyo.github.io'
Deno.serve(async (req) => {
 const origin = req.headers.get('origin') || ''
 const headers = {'Content-Type':'application/json', 'Access-Control-Allow-Origin':origin === site ? site : '', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin'}
 const reply = (status:number, body:unknown) => new Response(JSON.stringify(body), {status,headers})
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers})
 if(req.method!=='POST') return reply(405,{error:'POST required'})
 try {
  const {username,password,action} = await req.json()
  const name = typeof username==='string' ? username.trim().toLowerCase() : ''
  if(!/^[a-z0-9_]{3,24}$/.test(name)) return reply(400,{error:'Username must be 3–24 letters, numbers or underscores.'})
  if(typeof password!=='string' || password.length<10 || password.length>128) return reply(400,{error:'Use a password of 10–128 characters.'})
  if(action!=='login' && action!=='signup') return reply(400,{error:'Unknown account action'})
  const url=Deno.env.get('SUPABASE_URL')!
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  // Store hashes only; don't log credentials, IPs or tokens.
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const buckets=[[`ip:${hash}`,30],[`name:${name}`,15],['global',300]] as const
  for(const [bucket_key,max_attempts] of buckets){
   const r=await admin.rpc('league_auth_allow',{bucket_key,max_attempts})
   if(r.error || !r.data) return reply(429,{error:'Too many attempts. Try again in 15 minutes.'})
  }
  const email=`${name}@accounts.supasports.invalid`
  if(action==='signup'){
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true})
   if(created.error) return reply(400,{error:'Could not create that account. The username may already be taken.'})
  }
  const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const result=await auth.auth.signInWithPassword({email,password})
  if(result.error || !result.data.session) return reply(401,{error:'Username or password is incorrect.'})
  return reply(200,{session:{access_token:result.data.session.access_token,refresh_token:result.data.session.refresh_token}})
 }catch {return reply(400,{error:'Could not process the request.'})}
})
