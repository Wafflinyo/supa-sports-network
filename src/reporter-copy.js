import {pitchingNewsPerformance} from './game-headlines.js';

// League-news copy is generated from the uploaded report, never invented.
// Stable rotation varies phrasing across teammates, games and recognition types.
const n=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
const plural=(count,singular,multiple=singular+'s')=>count+' '+(count===1?singular:multiple);
const naturalList=values=>{
  const v=values.filter(Boolean);
  return v.length<=1?v[0]||'':v.length===2?v.join(' and '):v.slice(0,-1).join(', ')+', and '+v.at(-1);
};
const capitalize=s=>s.charAt(0).toUpperCase()+s.slice(1);
function pick(game,teamId,position,category,variants){
  let hash=2166136261;
  for(const char of [game.id,teamId,category].join(':'))
    hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  return variants[(((hash^(hash>>>16))>>>0)+Math.max(0,position||0))%variants.length];
}
const hrEvents=[
  ['oneHr','solo homer'],['twoHr','two-run homer'],
  ['threeHr','three-run homer'],['grandSlams','grand slam'],
];
function homerCopy(stats){
  const events=hrEvents.filter(([key])=>n(stats[key])>0);
  const known=events.reduce((total,[key])=>total+n(stats[key]),0);
  const total=Math.max(known,n(stats.homeRuns));
  const phrases=events.map(([key,name])=>
    n(stats[key])===1?'a '+name:n(stats[key])+' '+name+(name==='grand slam'?'s':'s'));
  if(total>known)phrases.push(total-known===1?'a homer':(total-known)+' homers');
  return naturalList(phrases);
}
const defenseCategories=[
  ['putouts','putout'],['assists','assist'],['doublePlays','double play'],
  ['triplePlays','triple play'],['buddyJumpPutouts','Buddy Jump putout'],
];

export function reporterParagraph(person,id,categories,game,teamId,opponent,teamName,position=0){
  const row=(game.result?.players||[]).find(r=>
    Number(r.player)===Number(id)&&String(r.team)===String(teamId));
  if(!row)return null;
  const s=row.stats||{},shown=new Set(categories),sentences=[];
  const choose=(kind,variants)=>pick(game,teamId,position,kind,variants);
  const hasHomer=shown.has('home-run')&&!!homerCopy(s);
  const offense=naturalList([
    n(s.runs)?plural(n(s.runs),'run')+' scored':null,
    n(s.rbi)?plural(n(s.rbi),'RBI','RBI'):null,
  ]);
  const hasOffense=shown.has('offense')&&!!offense;
  const hasPerfect=shown.has('perfect-batting');
  const defense=shown.has('defense')?naturalList(defenseCategories
    .filter(([key])=>n(s[key])>0).map(([key,label])=>plural(n(s[key]),label))):'';
  const defTotal=defenseCategories.reduce((sum,[key])=>sum+n(s[key]),0);
  const pitching=shown.has('pitching')?pitchingNewsPerformance(row,game):null;
  const batting=hasHomer||hasOffense||hasPerfect,field=!!defense,mound=!!pitching;
  const areas=[batting?'bat':null,field?'field':null,mound?'mound':null].filter(Boolean);
  const allThree=areas.length===3;
  const multiple=areas.length>=2;
  const lead=multiple?choose('all-round-'+areas.join('-'),[
    '',
    person+(allThree?' shined at bat, in the field, and on the mound.':
      batting&&field?' delivered at the plate and backed it up defensively.':
      batting&&mound?' was a factor with both bat and arm.':
      ' contributed both on the mound and in the field.'),
    person+(allThree?' excelled in all three phases: hitting, fielding, and pitching.':
      batting&&field?' proved valuable on both sides of the ball.':
      batting&&mound?' contributed at the plate and from the pitching rubber.':
      ' stood out with the glove and from the mound.'),
    '',
    person+(allThree?' left a mark at the plate, with the glove, and on the mound.':
      batting&&field?' made an all-around impact on offense and defense.':
      batting&&mound?' showed versatility at bat and on the mound.':
      ' contributed as both a fielder and a pitcher.'),
    '',
  ]):'';
  if(lead)sentences.push(lead);

  if(hasHomer&&hasOffense){
    const homer=homerCopy(s);
    const subject=lead?'At the plate, '+person:person;
    sentences.push(choose('homer-offense',[
      subject+' drove the offense with '+offense+', including '+homer+'.',
      subject+' launched '+homer+' while finishing with '+offense+'.',
      subject+' delivered '+offense+', highlighted by '+homer+'.',
      subject+' energized the lineup with '+homer+', finishing with '+offense+'.',
      subject+' capped an impressive offensive showing with '+offense+', highlighted by '+homer+'.',
      subject+' mixed timely production with power: '+offense+', including '+homer+'.',
    ]));
  }else if(hasHomer){
    const homer=homerCopy(s),subject=lead?'At the plate, '+person:person;
    sentences.push(choose('homer',[
      subject+' flashed the power, blasting '+homer+'.',
      subject+' brought the big bat with '+homer+'.',
      subject+' provided a spark by launching '+homer+'.',
      subject+' sent '+homer+' out of the park.',
      subject+' made a statement at the plate with '+homer+'.',
      subject+' came through with '+homer+'.',
    ]));
  }else if(hasOffense){
    const subject=lead?'At the plate, '+person:person;
    sentences.push(choose('offense',[
      subject+' put on an offensive clinic, recording '+offense+'.',
      subject+' powered the attack with '+offense+'.',
      subject+' turned in a productive outing, tallying '+offense+'.',
      subject+' helped carry the offense with '+offense+'.',
      subject+' delivered at the plate with '+offense+'.',
      subject+' kept the offense rolling, contributing '+offense+'.',
    ]));
  }
  if(field){
    const base=lead||sentences.length?[
      'Defensively, '+person+' added '+defense+'.',
      'The performance extended to the field, with '+defense+'.',
      'With the glove, '+person+' recorded '+defense+'.',
      'The fielding side of the performance included '+defense+'.',
      'On defense, '+person+' kept it going with '+defense+'.',
      'The all-around effort continued with '+defense+' in the field.',
      person+' was just as effective defensively, adding '+defense+'.',
      'The contributions did not stop at the plate: '+defense+' on defense.',
    ]:defTotal>=15?[
      person+' put on a defensive masterclass, racking up '+defense+'.',
      person+' delivered a spectacular defensive clinic with '+defense+'.',
      person+' was a force in the field, recording '+defense+'.',
      person+' anchored the defense with '+defense+'.',
      person+' put the glove to work, tallying '+defense+'.',
      person+' led the defensive effort with '+defense+'.',
      person+' turned in an exceptional fielding display, totaling '+defense+'.',
      person+' was all over the diamond with '+defense+'.',
    ]:defTotal>=11?[
      person+' turned in a strong defensive showing with '+defense+'.',
      person+' anchored the fielding effort, recording '+defense+'.',
      person+' came through with the glove, tallying '+defense+'.',
      person+' put together an impressive defensive performance with '+defense+'.',
      person+' kept busy in the field, collecting '+defense+'.',
      person+' stepped up defensively with '+defense+'.',
      person+' delivered a fielding clinic with '+defense+'.',
      person+' recorded a strong defensive outing, totaling '+defense+'.',
    ]:[
      person+' turned in a solid defensive outing, recording '+defense+'.',
      person+' contributed '+defense+' on defense.',
      person+' was sharp in the field, collecting '+defense+'.',
      person+' helped steady the defense with '+defense+'.',
      person+' put in good work with the glove, totaling '+defense+'.',
      person+' supplied a dependable defensive showing with '+defense+'.',
      person+' found plenty to do in the field, tallying '+defense+'.',
      person+' handled defensive duties well, adding '+defense+'.',
    ];
    sentences.push(choose('defense-'+(lead||sentences.length?'bridge':defTotal>=15?'elite':defTotal>=11?'strong':'solid'),base));
  }
  if(mound){
    const innings=Math.floor(pitching.outs/3)+'.'+(pitching.outs%3);
    const numbers=[innings+' innings pitched'];
    if(pitching.runs===0)numbers.push('no runs allowed');
    else if(pitching.runs>0)numbers.push(plural(pitching.runs,'run')+' allowed');
    if(pitching.ks>0)numbers.push(plural(pitching.ks,'strikeout'));
    if(pitching.pgp>=20)numbers.push(Number(pitching.pgp.toFixed(2))+' PGP');
    const line=naturalList(numbers),prefix=sentences.length?'On the mound, '+person:person;
    const tier=pitching.shutout?'shutout':pitching.tier==='great'?'masterclass':
      pitching.tier==='solid'?'strong':pitching.tier==='good'?'solid':'steady';
    const variants={
      shutout:[
        prefix+' played a part in the shutout, logging '+line+'.',
        prefix+' helped secure the shutout with '+line+'.',
        prefix+' held the opposition scoreless during the shutout, finishing with '+line+'.',
        prefix+' helped complete the shutout performance, posting '+line+'.',
        prefix+' came through in the shutout with '+line+'.',
      ],
      masterclass:[
        prefix+' put on a pitching masterclass, finishing with '+line+'.',
        prefix+' baffled hitters with '+line+'.',
        prefix+' was brilliant on the hill, compiling '+line+'.',
        prefix+' turned in an outstanding pitching performance with '+line+'.',
        prefix+' took command of the mound, delivering '+line+'.',
      ],
      strong:[
        prefix+' turned in an impressive pitching outing with '+line+'.',
        prefix+' showed sharp command, logging '+line+'.',
        prefix+' handled the opposition well, finishing with '+line+'.',
        prefix+' delivered a quality pitching performance with '+line+'.',
        prefix+' gave the team a strong outing on the mound, recording '+line+'.',
      ],
      solid:[
        prefix+' gave the team a solid pitching outing with '+line+'.',
        prefix+' delivered dependable work on the mound, posting '+line+'.',
        prefix+' turned in a good pitching performance with '+line+'.',
        prefix+' held steady from the mound, tallying '+line+'.',
        prefix+' contributed a solid outing on the hill with '+line+'.',
      ],
      steady:[
        prefix+' kept opposing hitters in check, finishing with '+line+'.',
        prefix+' limited the damage from the mound with '+line+'.',
        prefix+' logged a steady pitching outing with '+line+'.',
        prefix+' kept the outing under control with '+line+'.',
        prefix+' provided reliable innings with '+line+'.',
      ],
    };
    sentences.push(choose('pitch-'+tier,variants[tier]));
  }

  if(hasPerfect){
    const hrCount=hrEvents.reduce((sum,[key])=>sum+n(s[key]),0);
    const hits=s.hits!=null?n(s.hits):n(s.singles)+n(s.doubles)+n(s.triples)+
      Math.max(hrCount,n(s.homeRuns));
    const walks=n(s.batWalks),hitByPitch=n(s.hitByPitch);
    const pa=n(s.plateAppearances)||n(s.atBats)+walks+hitByPitch+n(s.sacFlys);
    const details=naturalList([
      hits?plural(hits,'hit'):null,
      walks?plural(walks,'walk'):null,
      hitByPitch?plural(hitByPitch,'hit by pitch','hit by pitches'):null,
    ]);
    if(pa>0)sentences.push(choose('perfect',[
      person+' also reached base in all '+pa+' plate appearances'+(details?', with '+details:'')+'.',
      'To cap it off, '+person+' reached safely on all '+pa+' trips to the plate'+
        (details?', collecting '+details:'')+'.',
      person+' could not be kept off base, reaching safely in all '+pa+' plate appearances'+
        (details?', thanks to '+details:'')+'.',
      'The on-base performance was flawless: '+person+' reached in all '+pa+
        ' plate appearances'+(details?', with '+details:'')+'.',
    ]));
  }
  if(!sentences.length)return null;
  const scores=game.result?.scores||{};
  const opponentId=String(game.away)===String(teamId)?game.home:game.away;
  const valid=Object.hasOwn(scores,teamId)&&Object.hasOwn(scores,opponentId);
  const our=valid?Number(scores[teamId]):NaN,theirs=valid?Number(scores[opponentId]):NaN;
  const week=Number(game.week),when=Number.isInteger(week)&&week>0?' in Week '+week:'';
  const thisWeek=when?'Week '+week+' ':'';
  const close=Number.isFinite(our)&&Number.isFinite(theirs)&&Math.abs(our-theirs)<=2;
  const opp='the '+opponent;
  if(Number.isFinite(our)&&Number.isFinite(theirs)&&our>theirs){
    sentences.push(choose('win',[
      'The effort came in '+teamName+"'s "+(close?'close ':'')+'victory over '+opp+when+'.',
      'It all helped '+teamName+' secure a '+(close?'narrow ':'')+'win over '+opp+when+'.',
      'The contributions were part of a '+(close?'hard-fought ':'')+'win against '+opp+when+'.',
      'The performance helped the team prevail over '+opp+when+'.',
      'Those numbers came as '+teamName+' defeated '+opp+when+'.',
      'The outing was a bright spot in the '+thisWeek+'win over '+opp+'.',
    ]));
  }else if(Number.isFinite(our)&&Number.isFinite(theirs)&&our<theirs){
    sentences.push(choose('loss',[
      'Despite the defeat to '+opp+when+', '+person+' gave '+teamName+' something to celebrate.',
      'Even as '+teamName+' fell short against '+opp+when+', '+person+"'s "+'performance stood out.',
      'The result went '+opp+"'s way"+when+', but '+person+' still delivered.',
      'Though '+teamName+' lost to '+opp+when+', '+person+' supplied a bright spot.',
      'The loss to '+opp+when+" couldn't overshadow "+person+"'s "+'contributions.',
      'It was a tough result against '+opp+when+', but '+person+' made the most of the outing.',
      'Although '+teamName+' came up short against '+opp+when+', '+person+' still had an outing worth recognizing.',
      'In a losing effort against '+opp+when+', '+person+' was a clear standout.',
      'The scoreboard favored '+opp+when+', yet '+person+' gave '+teamName+' a performance to build on.',
      'Despite the disappointing result against '+opp+when+', '+person+' remained a highlight for '+teamName+'.',
    ]));
  }else{
    sentences.push(choose('no-result',[
      'The performance came against '+opp+when+'.',
      'Those numbers were recorded against '+opp+when+'.',
    ]));
  }
  return sentences.join(' ');
}
