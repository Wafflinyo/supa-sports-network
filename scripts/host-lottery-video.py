#!/usr/bin/env python3
"""Produce the public SSL 12-pick sample MP4 for GitHub Pages.
The draw order is EXAMPLE ONLY; never read or modify the real server lottery.
Uses the same timings as src/lottery-timing.js (10s mix, 3.2s roll, 8s announce).
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
INTRO,MIX,ROLL,ANN=10,10,3.2,8
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
 draw.text((W//2,532),'SAMPLE DRAW  /  CINEMATIC COLLISION CAGE  /  ALL TWELVE PICKS',anchor='mb',font=f10,fill=(140,167,200))
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
  d.rounded_rectangle((CX+RING-3,CY+74,CX+RING+38,CY+84),radius=3,fill=(212,152,66))
  d.rounded_rectangle((504,318,861,329),radius=5,fill=(198,132,46),outline=(250,213,133),width=2)
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
   px=495+(710-495)*ease;py=258-32*(1-ease)+8*math.sin(math.pi*u)
   ball_logo(pic,px,py,63,selected,True,rotation=-1000*(1-ease))
  elif style in ('announce','complete'):ball_logo(pic,710,258,63,selected,True)
  else:
   ball_logo(pic,710,258,53,1)
   d=ImageDraw.Draw(pic);d.ellipse((681,231,740,289),fill=(245,210,91),outline=(255,244,190),width=2)
   d.text((710,234),'?',font=f40,anchor='mt',fill=(37,46,68))
  d=ImageDraw.Draw(pic)
  chosenfont=f21 if d.textbbox((0,0),title,font=f25)[2]>412 else f25
  d.text((710,343),title,anchor='mt',font=chosenfont,fill=white)
  d.text((710,375),minor,anchor='mt',font=f12,fill=gold if style=='waiting' else blue)
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
  hz=16000;n=int(DURATION*hz);data=np.zeros(n,np.float32)
  rng=np.random.default_rng(11)
  def impact(t,volume=.18):
   start=int(t*hz);length=int(.095*hz)
   if start>=n:return
   size=min(length,n-start);u=np.arange(size)/hz;freq=rng.uniform(720,1250)
   data[start:start+size]+=volume*np.exp(-u*55)*(np.sin(2*np.pi*freq*u)+.2*np.sin(2*np.pi*freq*2.5*u))
  def rolling(t):
   start=int(t*hz);num=min(int(ROLL*hz),n-start)
   if num<=0:return
   u=np.arange(num)/hz;white=rng.standard_normal(num)
   smooth=np.convolve(white,np.ones(21)/21,mode='same')
   envelope=np.minimum(1,u/.12)*np.minimum(1,(ROLL-u)/.15)
   data[start:start+num]+=(smooth*.28+.035*(np.sin(2*np.pi*(11+u*1.3)*u)**10))*envelope
   impact(t+2.75,.19);impact(t+3.1,.23)
  def announced(t):
   st=int(t*hz);num=min(int(.7*hz),n-st)
   if num<=0:return
   u=np.arange(num)/hz;env=(1-np.exp(-u*55))*np.exp(-4*u)
   data[st:st+num]+=.14*env*(np.sin(2*np.pi*660*u)+.5*np.sin(2*np.pi*990*u))
  pos=0
  for i in range(12):
   length=INTRO if i==0 else MIX;t=pos+.06
   while t<pos+length-.18:
    t+=float(rng.uniform(.16,.42));impact(t,float(rng.uniform(.12,.23)))
   pos+=length;rolling(pos);pos+=ROLL;announced(pos);pos+=ANN
  data=np.tanh(data*1.45)*.76
  with wave.open(str(wavpath),'wb') as w:
   w.setnchannels(1);w.setsampwidth(2);w.setframerate(hz)
   w.writeframes(np.int16(data*32767).tobytes())
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
