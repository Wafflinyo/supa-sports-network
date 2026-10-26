#!/usr/bin/env python3
"""Produce the public SSL 12-pick sample MP4 for GitHub Pages.
The draw order is EXAMPLE ONLY; never read or modify the real server lottery.
Uses the same timings as src/lottery-timing.js (10s mix, 3.2s roll, 5s announce).
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import numpy as np
import urllib.request
import subprocess
import tempfile
import math
import random
import wave
import os

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'public'/'videos'/'ssl-draft-lottery-12-picks.mp4'
DEST.parent.mkdir(parents=True,exist_ok=True)
FPS=8
W,H=960,540
INTRO,MIX,ROLL,ANN=10,10,3.2,5
DURATION=INTRO+11*MIX+12*(ROLL+ANN)+1.2
LOGOS=[
 ('Delfino Dolphins','1/76fc9d22-ade5-4b0f-89b3-c23bcb055248.png'),
 ('HopeDogo Retrievers 3','2/f1b981d6-d38d-4633-a575-20cc4e547e8c.png'),
 ('Petalburg Petilils','3/f6a49cf7-ac71-4acb-9109-8a5f8bae826b.png'),
 ('Moleville Haliban','4/f40d2bb4-dc79-484c-8923-7a492c03d5f2.jpg'),
 ('Diamond City Checkers','5/96c5e34c-f328-4c17-98d7-9aeadae625b0.png'),
 ('Starborn Voidstriders','6/5a445db7-b910-43e2-9adf-6eef16d5a559.png'),
 ('New Donk City Knights','7/d775ab4f-5fe2-44d1-9445-24097700b9d7.jpg'),
 ('Petalburg Pangolins','8/6f891562-13fe-4028-b250-7db8662a3acb.jpg'),
 ('New Donk City Fuggetaboudits','9/13160e2b-3a52-4f33-9149-908a68af911f.png'),
 ('Rogueport Ruffians','10/47db7ba3-31f0-4923-b434-7b920a3d77ad.png'),
 ('Twilight Town Tanks','11/c9d0548b-03b7-4eed-95f6-84e6f855391e.png'),
 ('Decalburg Dedennes','12/8ba4cb95-271c-42f2-8f63-0be56141b374.png'),
]
ORDER=[7,3,1,10,6,12,4,2,8,11,5,9]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
font=lambda size:ImageFont.truetype(FONT,size)
f10,f11,f12,f13,f15,f17,f21,f25,f40=[font(i) for i in (10,11,12,13,15,17,21,25,40)]
gold=(255,221,138);white=(249,251,255);blue=(193,212,237)
random.seed(79)

with tempfile.TemporaryDirectory() as temp:
 base=Path(temp)
 ims={}
 for k,(name,filename) in enumerate(LOGOS,1):
  url='https://vocaddalptoghysgdkvh.supabase.co/storage/v1/object/public/ssl-team-logos/'+filename
  urllib.request.urlretrieve(url,base/('team-'+str(k)+'.img'))
  im=Image.open(base/('team-'+str(k)+'.img')).convert('RGBA')
  if k==3:im=im.crop((0,0,im.width,int(im.height*.78)))
  if k==7:
   rgb=np.asarray(im.convert('RGB'))
   content=np.max(rgb,axis=2)>35
   yy,xx=np.where(content)
   if len(xx):im=im.crop((max(0,int(xx.min())-14),max(0,int(yy.min())-14),min(im.width,int(xx.max())+15),min(im.height,int(yy.max())+15)))
  if k==12:
   bg=Image.new('RGBA',im.size,(248,245,232,255))
   bg.alpha_composite(im);im=bg
  ims[k]=im
  print('Loaded team logo:',k,name,flush=True)
 def fit(im,w,h):
  cp=im.copy();cp.thumbnail((w,h),Image.Resampling.LANCZOS);return cp
 small={k:fit(im,27,27) for k,im in ims.items()}
 large={k:fit(im,110,110) for k,im in ims.items()}
 mini={k:fit(im,33,33) for k,im in ims.items()}
 # Prepare polished fixed title, cage stage and pick grid.
 x=np.arange(W,dtype=np.float32)[None,:];y=np.arange(H,dtype=np.float32)[:,None]
 d2=(x-185)**2/(W*W)+(y-152)**2/(H*H)
 fog=np.exp(-d2*3)
 back=np.zeros((H,W,3),dtype=np.uint8)
 back[:,:,0]=(10+18*fog).astype('uint8')
 back[:,:,1]=(22+38*fog).astype('uint8')
 back[:,:,2]=(43+55*fog).astype('uint8')
 static=Image.fromarray(back,'RGB').convert('RGBA')
 draw=ImageDraw.Draw(static)
 draw.text((W//2,8),'SUPA SPORTS NETWORK  /  SEASON 1',anchor='mt',font=f11,fill=gold)
 draw.text((W//2,21),'SSL DRAFT LOTTERY',anchor='mt',font=f40,fill=white,stroke_width=1,stroke_fill=(9,15,34))
 draw.text((W//2,68),'12 FRANCHISES    ·    LOGO BINGO BALLS    ·    SNAKE DRAFT',anchor='mt',font=f12,fill=blue)
 draw.text((W//2,84),'FULL-LENGTH SAMPLE  /  EXAMPLE ORDER ONLY  /  NOT OFFICIAL RESULTS',anchor='mt',font=f10,fill=gold)
 draw.rounded_rectangle((22,102,938,390),radius=12,fill=(12,29,57,255),outline=(225,175,72),width=3)
 draw.text((220,110),'SSL LOTTERY CAGE',anchor='mt',font=f12,fill=gold)
 draw.line((421,135,421,365),fill=(160,134,85,120),width=2)
 draw.text((480,401),'DRAFT ORDER  /  LIVE REVEAL',anchor='mt',font=f13,fill=gold)
 draw.text((W//2,532),'SAMPLE DRAW  /  GAME-SHOW MUSIC + MARBLE EFFECTS  /  INDEPENDENT VOLUME CONTROLS ON THE LIVE SITE',anchor='mb',font=f10,fill=(140,167,200))
 for n in range(12):
  col=n%4;row=n//4;left=23+col*234;top=425+row*34
  draw.rounded_rectangle((left,top,left+225,top+30),radius=4,fill=(30,48,78,255),outline=(76,97,131,255))
  draw.text((left+9,top+6),str(n+1).zfill(2),font=f17,fill=(227,178,76))
  draw.text((left+45,top+9),'AWAITING DRAW',font=f11,fill=(121,146,180))
 def phase(t):
  if t<INTRO:return 0,'intro',t,INTRO-t
  offset=t-INTRO
  for idx in range(12):
   if idx>0:
    if offset<MIX:return idx,'mixing',offset,MIX-offset
    offset-=MIX
   if offset<ROLL:return idx+1,'rolling',offset,ROLL-offset
   offset-=ROLL
   if offset<ANN:return idx+1,'announce',offset,ANN-offset
   offset-=ANN
  return 12,'complete',0,0
 CX,CY,RING,BR=220,255,123,16
 balls=[];prior=-1;prior_state='';theta=0
 def reset(ids):
  result=[]
  for j,k in enumerate(ids):
   angle=2*math.pi*j/max(1,len(ids))+.2
   rad=43 if j%2 else 77
   result.append([k,CX+math.cos(angle)*rad,CY+math.sin(angle)*rad,math.sin(angle)*138,-math.cos(angle)*138,0,j*1.7])
  return result
 def physics(dt):
  nonlocal_placeholder=False
  global theta
  bound=RING-BR-8
  for ball in balls:
   k,px,py,vx,vy,ang,seed=ball
   vx+=((-(py-CY)*.95)+math.sin(px*.04+seed)*95+(random.random()-.5)*170)*dt
   vy+=(((px-CX)*.95)+75+(random.random()-.5)*170)*dt
   speed=math.hypot(vx,vy)
   if speed>240:vx*=240/speed;vy*=240/speed
   px+=vx*dt;py+=vy*dt;ang+=(vx+vy)*dt*.013;vx*=.995;vy*=.995
   rr=math.hypot(px-CX,py-CY)
   if rr>bound:
    nx=(px-CX)/rr;ny=(py-CY)/rr;px=CX+nx*bound;py=CY+ny*bound
    normal=vx*nx+vy*ny
    if normal>0:vx-=1.82*normal*nx;vy-=1.82*normal*ny
   ball[1:6]=[px,py,vx,vy,ang]
  for i in range(len(balls)):
   for j in range(i+1,len(balls)):
    aa=balls[i];bb=balls[j];dx=bb[1]-aa[1];dy=bb[2]-aa[2]
    dist=max(.001,math.hypot(dx,dy));minimum=2*BR+1
    if dist>=minimum:continue
    nx,ny=dx/dist,dy/dist;over=(minimum-dist)/2
    aa[1]-=nx*over;aa[2]-=ny*over;bb[1]+=nx*over;bb[2]+=ny*over
    relative=(bb[3]-aa[3])*nx+(bb[4]-aa[4])*ny
    if relative<0:
     impulse=-(1+.86)*relative/2
     aa[3]-=impulse*nx;aa[4]-=impulse*ny
     bb[3]+=impulse*nx;bb[4]+=impulse*ny
 def ball_logo(pic,px,py,r,k,big=False,rotation=0):
  d=ImageDraw.Draw(pic)
  d.ellipse((px-r+4,py-r+7,px+r+4,py+r+7),fill=(1,8,19,115))
  d.ellipse((px-r,py-r,px+r,py+r),fill=(222,155,30),outline=(255,232,157),width=3 if big else 2)
  d.ellipse((px-r+3,py-r+3,px+r-3,py+r-3),fill=(255,223,104),outline=(199,133,29),width=1)
  d.ellipse((px-r+4,py-r+4,px-r+int(.62*r),py-r+int(.45*r)),fill=(255,250,209))
  logo=(large if big else small)[k]
  if abs(rotation)>.01:logo=logo.rotate(rotation,Image.Resampling.BICUBIC,expand=False)
  pic.alpha_composite(logo,(int(px-logo.width/2),int(py-logo.height/2)))
 def render(t):
  global balls,prior,prior_state,theta
  revealed,state,elapsed,remaining=phase(t)
  if revealed!=prior or state!=prior_state:
   balls=reset(ORDER[revealed:]);prior=revealed;prior_state=state
  if state in ('intro','mixing'):
   for _ in range(8):physics(1/64)
   theta+=.125*1.15
  pic=static.copy();d=ImageDraw.Draw(pic)
  d.text((370,116),str(len(balls))+' BALLS INSIDE',font=f11,fill=blue)
  d.rounded_rectangle((CX-8,CY+113,CX+8,CY+137),radius=4,fill=(177,112,36))
  d.rounded_rectangle((CX-67,CY+135,CX+67,CY+145),radius=4,fill=(224,175,81))
  d.ellipse((CX-RING-4,CY-RING-4,CX+RING+4,CY+RING+4),fill=(16,44,76),outline=(245,194,95),width=8)
  for off in range(-110,111,22):
   chord=int(math.sqrt(max(0,(RING-12)**2-off**2)))
   d.line((CX+off,CY-chord,CX+off,CY+chord),fill=(81,111,139,135),width=2)
   d.line((CX-chord,CY+off,CX+chord,CY+off),fill=(81,111,139,135),width=2)
  for ball in balls:ball_logo(pic,ball[1],ball[2],BR,ball[0])
  d=ImageDraw.Draw(pic)
  for off in [-70,-5,62]:d.line((CX+off,CY-92,CX+off,CY+92),fill=(186,161,112,80),width=2)
  d.ellipse((CX-RING,CY-RING,CX+RING,CY+RING),outline=(247,213,133),width=3)
  d.ellipse((CX-5,CY-5,CX+5,CY+5),fill=(255,226,151))
  d.rounded_rectangle((CX+RING-3,CY+35,CX+RING+34,CY+46),radius=3,fill=(212,152,66),outline=(255,225,143))
  # Long sloping track physically connects the exit to the raised display.
  d.polygon([(340,315),(645,303),(645,316),(340,328)],fill=(127,78,30),outline=(252,210,123))
  d.line((343,309,645,297),fill=(255,226,158),width=4)
  d.line((342,330,645,318),fill=(161,109,47),width=3)
  # The selection podium: gold top, dark brass riser, engraved SSL base.
  d.rounded_rectangle((637,308,781,323),radius=7,fill=(214,157,61),outline=(255,226,150),width=3)
  d.rounded_rectangle((671,321,747,335),radius=3,fill=(124,81,29),outline=(237,198,113),width=2)
  d.text((709,322),'SSL',anchor='mt',font=f11,fill=(255,232,155))
  d.rounded_rectangle((649,333,770,344),radius=5,fill=(174,117,44),outline=(255,218,136),width=2)
  selected=ORDER[revealed-1] if revealed else None
  if state=='intro':label='OPENING CAGE MIX';title='LET THE BALLS MIX…';minor='FIRST BALL ROLLS OUT IN  '+str(math.ceil(remaining))+'s';style='waiting'
  elif state=='mixing':label='MIXING FOR THE NEXT PICK';title='NEXT FRANCHISE UP…';minor='NEXT BALL ROLLS OUT IN  '+str(math.ceil(remaining))+'s';style='waiting'
  elif state=='rolling':label='THE NEXT BALL IS ROLLING OUT';title='THE BALL IS COMING DOWN THE CHUTE…';minor='Rolling into position · please stand by';style='rolling'
  elif state=='announce':label='OFFICIAL PICK ANNOUNCED';title='#'+str(revealed)+'  ·  '+LOGOS[selected-1][0];minor=str(12-revealed)+' franchises waiting · next mix starts after this announcement';style='announce'
  else:label='THE OFFICIAL ORDER IS IN';title='ALL 12 FRANCHISES HAVE BEEN DRAWN';minor='Lottery complete · sample only';style='complete'
  d.rounded_rectangle((522,144,897,173),radius=6,fill=(57,54,53),outline=(223,186,106),width=1)
  d.text((710,152),label,anchor='mt',font=f15,fill=gold)
  if style=='rolling':
   u=min(1,elapsed/ROLL);ease=1-(1-u)**2.6
   px=355+(710-355)*ease
   py=251-6*ease+7*math.sin(math.pi*u)
   # PIL-positive angle is counter-clockwise. Decreasing a positive angle
   # moves clockwise, matching a physical ball rolling to the right.
   ball_logo(pic,px,py,63,selected,True,rotation=1080*(1-ease))
  elif style in ('announce','complete'):ball_logo(pic,710,245,63,selected,True)
  else:
   d=ImageDraw.Draw(pic)
   d.text((709,250),'NEXT',font=f21,anchor='mt',fill=(220,185,115))
   d.text((709,273),'BALL',font=f21,anchor='mt',fill=(220,185,115))
  d=ImageDraw.Draw(pic)
  chosenfont=f21 if d.textbbox((0,0),title,font=f25)[2]>412 else f25
  d.text((710,351),title,anchor='mt',font=chosenfont,fill=white)
  d.text((710,379),minor,anchor='mt',font=f12,fill=gold if style=='waiting' else blue)
  shown=revealed-1 if state=='rolling' else revealed
  for ix in range(shown):
   teamid=ORDER[ix];col=ix%4;row=ix//4;left=23+col*234;top=425+row*34
   d.rounded_rectangle((left,top,left+225,top+30),radius=4,fill=(37,63,93),outline=(211,175,96),width=1)
   d.text((left+9,top+6),str(ix+1).zfill(2),font=f17,fill=gold)
   icon=mini[teamid];pic.alpha_composite(icon,(left+34+(33-icon.width)//2,top+(30-icon.height)//2))
   nm=LOGOS[teamid-1][0];nf=f10 if len(nm)>23 else f12
   d.text((left+75,top+8),nm[:35],font=nf,fill=white)
  d.text((900,403),str(shown)+' OF 12',anchor='rt',font=f13,fill=blue)
  return pic.convert('RGB')
 def sound(wavpath):
  # A faster punchy 138 BPM brass-led game-show groove with short
  # lower-pitched billiard ball impacts and a roll over wood and felt.
  # The real site exposes individual mute/volume controls for these two buses.
  hz=24000
  n=math.ceil(DURATION*hz)
  music=np.zeros(n,np.float32)
  effects=np.zeros(n,np.float32)
  rng=np.random.default_rng(20261025)
  beat=60/138
  half=beat/2
  roots=[48,43,45,41]   # C, G, A minor, F
  chords=[[60,64,67],[55,59,62],[57,60,64],[53,57,60]]
  melodies=[
   [76,79,83,79,76,79,84,79],
   [74,79,83,79,74,79,86,79],
   [76,81,84,81,76,81,88,81],
   [72,77,81,77,72,77,84,77]
  ]
  def add(buf,at,signal):
   st=int(at*hz)
   if st>=n or st+len(signal)<=0:return
   lo=max(0,-st);end=min(len(signal),n-st)
   if end>lo:buf[max(0,st):max(0,st)+end-lo]+=signal[lo:end].astype(np.float32)
  def note(at,midi,dur=.2,volume=.1,kind='marimba'):
   if at>=DURATION:return
   samples=max(10,int((dur+.05)*hz))
   t=np.arange(samples,dtype=np.float32)/hz
   freq=440*2**((midi-69)/12)
   if kind=='bass':
    env=(1-np.exp(-t*110))*np.exp(-t/max(.09,dur*.78))
    wave=np.sin(2*np.pi*freq*t)+.23*np.sin(2*np.pi*2*freq*t)
   elif kind=='chord':
    env=(1-np.exp(-t*160))*np.exp(-t/max(.09,dur*.57))
    # Band-limited brassy reed stab with more midrange oomph.
    wave=(np.sin(2*np.pi*freq*t)+.37*np.sin(2*np.pi*2*freq*t)
          +.19*np.sin(2*np.pi*3*freq*t)+.10*np.sin(2*np.pi*4*freq*t))
   else:
    env=(1-np.exp(-t*380))*np.exp(-t/max(.055,dur*.72))
    wave=np.sin(2*np.pi*freq*t)+.28*np.sin(2*np.pi*2.02*freq*t)*np.exp(-t*19)
   add(music,at,wave*env*volume)
  def kick(at):
   t=np.arange(int(.17*hz),dtype=np.float32)/hz
   frequency=55+110*np.exp(-t*29)
   phase=2*np.pi*(55*t+(110/29)*(1-np.exp(-t*29)))
   env=(1-np.exp(-t*600))*np.exp(-t*25)
   add(music,at,np.sin(phase)*env*.35)
  def snare(at):
   t=np.arange(int(.145*hz),dtype=np.float32)/hz
   white=rng.standard_normal(len(t)).astype(np.float32)
   high=np.empty_like(white)
   high[0]=0
   high[1:]=white[1:]-.83*white[:-1]
   env=np.exp(-t*26)
   add(music,at,high*env*.095+.082*np.sin(2*np.pi*188*t)*np.exp(-t*35))
  def hat(at,accent=False):
   t=np.arange(int(.073*hz),dtype=np.float32)/hz
   white=rng.standard_normal(len(t)).astype(np.float32)
   high=np.diff(white,prepend=white[0])
   add(music,at,high*np.exp(-t*79)*(.036 if accent else .025))
  for step in range(int(DURATION/half)+2):
   t=step*half
   if t>=DURATION:break
   count=step%8
   bar=(step//8)%4
   if count%2==0:
    if count in (0,4):kick(t)
    if count in (2,6):snare(t)
    note(t,roots[bar],.27,.19,'bass')
    note(t,roots[bar]-12,.26,.095,'bass')
    hat(t,False)
   else:
    hat(t,True)
    if count in (3,7):kick(t)
   if count in (0,2,3,4,6,7):
    note(t,melodies[bar][count],.22,.090 if count in (0,4) else .072)
   if count in (0,3,6):
    for tone in chords[bar]:note(t,tone,.22,.061,'chord')
  def marble_clink(at,vol=.36):
   # A billiard ball's dry, sharp low-mid crack, with no glass-like high
   # ringing. Short phenolic resonances and felt-covered table knock.
   fundamental=rng.uniform(380,610)
   modes=[(1,.039,.56),(1.47,.022,.18),(2.18,.012,.038)]
   length=int(.080*hz);t=np.arange(length,dtype=np.float32)/hz
   tone=np.zeros(length,np.float32)
   for ratio,decay,amp in modes:
    tone+=amp*np.sin(2*np.pi*fundamental*ratio*t+rng.uniform(0,.5))*np.exp(-t/decay)
   low=.33*np.sin(2*np.pi*220*t)*np.exp(-t*47)
   attack=1-np.exp(-t*1300)
   add(effects,at,(tone+low)*attack*vol)
  def wood_tick(at,strength=.12):
   t=np.arange(int(.055*hz),dtype=np.float32)/hz
   freq=rng.uniform(260,530)
   sig=np.sin(2*np.pi*freq*t)*np.exp(-t*90)
   add(effects,at,sig*strength)
  def marble_roll(at):
   size=min(int(ROLL*hz),n-int(at*hz))
   if size<=0:return
   t=np.arange(size,dtype=np.float32)/hz
   noise=rng.standard_normal(size).astype(np.float32)
   # Low-frequency dry rolling friction over a wooden/felt-topped chute.
   kernel=np.ones(57,dtype=np.float32)/57
   grain=np.convolve(noise,kernel,mode='same')
   fine=np.convolve(noise,np.ones(7,dtype=np.float32)/7,mode='same')
   env=np.minimum(1,t/.14)*np.minimum(1,np.maximum(.0001,ROLL-t)/.28)
   grain_wave=(grain*.28+fine*.062)*env
   add(effects,at,grain_wave)
   tick_at=.16
   while tick_at<ROLL-.23:
    wood_tick(at+tick_at,.025+rng.uniform(0,.022))
    tick_at+=rng.uniform(.19,.33)
   marble_clink(at+ROLL-.08,.72)
   wood_tick(at+ROLL-.025,.11)
  def announcement_sting(at):
   # Compact rising "winning draw" two-note xylophone fanfare.
   for offset,pitch in [(0,79),(.13,83),(.27,88)]:
    note(at+offset,pitch,.32,.125,'marimba')
  pos=0
  for i in range(12):
   length=INTRO if i==0 else MIX
   t=pos+.04
   while t<pos+length-.10:
    t+=float(rng.uniform(.15,.34))
    marble_clink(t,float(rng.uniform(.27,.58)))
    if rng.random()<.20:wood_tick(t+.014,.044)
   pos+=length
   marble_roll(pos)
   pos+=ROLL
   announcement_sting(pos)
   pos+=ANN
  # User-facing default mix: gameshow music behind, marbles clear and up front.
  combined=music*.90+effects*.79
  combined=np.tanh(combined*1.16)*.87
  with wave.open(str(wavpath),'wb') as w:
   w.setnchannels(1);w.setsampwidth(2);w.setframerate(hz)
   w.writeframes(np.int16(combined*32767).tobytes())
 silent=base/'silent.mp4';wav=base/'sound.wav'
 ff=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',str(W)+'x'+str(H),'-r',str(FPS),'-i','pipe:0','-c:v','libx264','-preset','ultrafast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
 nframes=math.ceil(DURATION*FPS)
 for i in range(nframes):
  pic=render(i/FPS)
  ff.stdin.write(pic.tobytes())
  if i%256==0:print('Rendering',i,'/',nframes,flush=True)
 ff.stdin.close()
 if ff.wait()!=0:raise RuntimeError('Video encoding failed')
 sound(wav)
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(silent),'-i',str(wav),'-c:v','copy','-c:a','aac','-b:a','96k','-shortest','-movflags','+faststart',str(DEST)],check=True)
 print('Hosted sample ready:',DEST,DEST.stat().st_size,'bytes',flush=True)
