(()=> {
/* ======= DOM ======= */
const $ = id => document.getElementById(id);

// HUD
const hud = {
  hpFill: $('hpFill'), hpText: $('hpText'),
  ammoText: $('ammoText'), wName: $('wName'),
  kills: $('kills'), tCnt: $('treasureCount'),
  tVal: $('treasureValue'), cap: $('capText'),
  fps: $('fps'), tip: $('tip'),
  credits: $('creditsText'), phase: $('phaseText'),
};

// Overlays
const armoryUI = $('armoryUI'), warehouseUI = $('warehouseUI'), lootUI = $('lootUI'), cin = $('cin');
// Armory controls
const ammoRange=$('ammoRange'), ammoLabel=$('ammoLabel'), medkit=$('medkit'), armoryApply=$('armoryApply'), armoryClose=$('armoryClose'), billText=$('billText');
// Warehouse controls
const warehouseClose=$('warehouseClose'), sellAll=$('sellAll'), creditsInUI=$('creditsInUI'), bagList=$('bagList'), bagCap=$('bagCap'), bagVal=$('bagVal');
// Loot controls
const lootClose=$('lootClose'), takeAll=$('takeAll'), lootList=$('lootList');

/* ======= Canvas / Utils ======= */
const cnv = document.getElementById('game'), ctx = cnv.getContext('2d');
let W=innerWidth, H=innerHeight; cnv.width=W; cnv.height=H;

const rand=(a,b)=>Math.random()*(b-a)+a;
const randi=(a,b)=>Math.floor(rand(a,b+1));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const choice = arr => arr[Math.floor(Math.random()*arr.length)];

const STAR_COUNT = 220;
let starfield = [];
function createStarfield(count=STAR_COUNT){
  return Array.from({length:count},()=>({
    x:Math.random()*W,
    y:Math.random()*H,
    size:rand(0.6,1.6),
    speed:rand(0.16,0.48),
    phase:Math.random()*Math.PI*2,
  }));
}

starfield = createStarfield(STAR_COUNT);

addEventListener('resize', ()=>{
  W=innerWidth; H=innerHeight; cnv.width=W; cnv.height=H;
  starfield = createStarfield(starfield.length||STAR_COUNT);
});

/* ======= Visuals ======= */
function neonCircle(x,y,r,color,fillAlpha=0.15,glow=16){
  ctx.save(); ctx.shadowBlur=glow; ctx.shadowColor=color; ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke();
  ctx.globalAlpha=fillAlpha; ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.restore(); ctx.globalAlpha=1;
}
function neonWedge(x,y,r,ang,color){
  ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.shadowBlur=14; ctx.shadowColor=color; ctx.fillStyle=color;
  ctx.beginPath(); ctx.moveTo(r*0.9,0); ctx.lineTo(-r*0.6, r*0.55); ctx.lineTo(-r*0.6,-r*0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawBG(dt=16, now=performance.now()){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  ctx.clearRect(0,0,W,H);

  const baseGrad=ctx.createRadialGradient(W*0.55,H*0.3,80,W*0.55,H*0.3,Math.max(W,H));
  baseGrad.addColorStop(0,'#09122b');
  baseGrad.addColorStop(0.55,'#070b17');
  baseGrad.addColorStop(1,'#04060d');
  ctx.fillStyle=baseGrad;
  ctx.fillRect(0,0,W,H);

  const time=now*0.001;

  ctx.save();
  ctx.strokeStyle='rgba(120,170,255,0.12)';
  ctx.lineWidth=1;
  const gridSpacing=140;
  const gridOffset=(now*0.04)%gridSpacing;
  ctx.beginPath();
  for(let x=-gridSpacing; x<W+gridSpacing; x+=gridSpacing){
    const pos=x+gridOffset;
    ctx.moveTo(pos,0);
    ctx.lineTo(pos,H);
  }
  ctx.stroke();
  ctx.strokeStyle='rgba(90,130,220,0.14)';
  ctx.beginPath();
  for(let y=-gridSpacing; y<H+gridSpacing; y+=gridSpacing){
    const pos=y+(gridOffset*0.7);
    ctx.moveTo(0,pos);
    ctx.lineTo(W,pos);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle='#9ecbff';
  for(const star of starfield){
    star.y += star.speed * dt * 0.04;
    star.x += Math.sin(time*0.4 + star.phase) * star.speed * dt * 0.008;
    if(star.y>H+20){ star.y=-20; star.x=Math.random()*W; }
    if(star.x<-20){ star.x=W+20; }
    if(star.x>W+20){ star.x=-20; }
    ctx.globalAlpha=0.35 + star.speed*0.8;
    ctx.fillRect(star.x, star.y, star.size, star.size*2.2);
  }
  ctx.restore();
  ctx.globalAlpha=1;
}

/* ======= FX：刀光/火花/屏幕震动 ======= */
let slashFX=[];   // {x,y,angle,t,dur,r,arc,flare}
let sparks=[];    // {x,y,vx,vy,t,dur,color}
let shakeT=0, shakeMag=0;
function addShake(mag=8,time=120){ shakeMag=Math.max(shakeMag,mag); shakeT=Math.max(shakeT,time); }

/* ======= Economy & Persist ======= */
const LS_CRED='neonraid_credits_v2';
const LS_CORPSES='neonraid_corpses_v2';
const LS_START='neonraid_hasStarter_v1';
let credits = Number(localStorage.getItem(LS_CRED)||0);
if(!localStorage.getItem(LS_START)){ credits += 300; localStorage.setItem(LS_START,'1'); }
function saveCredits(){ localStorage.setItem(LS_CRED,String(credits)); hud.credits.textContent=credits; }
let corpses = loadCorpses();
function loadCorpses(){ try{return JSON.parse(localStorage.getItem(LS_CORPSES)||'[]')}catch(e){return[]} }
function saveCorpses(){ try{ localStorage.setItem(LS_CORPSES, JSON.stringify(corpses.slice(-300))); }catch(e){} }
hud.credits.textContent = credits;

/* ======= Worlds ======= */
const baseWorld={w:1600,h:900}, baseCam={x:800,y:450};
const baseZones={ armory:{x:350,y:450,r:90,label:'Armory'}, warehouse:{x:800,y:450,r:90,label:'Warehouse'}, runway:{x:1250,y:450,r:110,label:'Runway'} };
const baseObstacles=(()=>{const a=[]; for(let i=0;i<22;i++) a.push({x:rand(120,baseWorld.w-120),y:rand(120,baseWorld.h-120),r:rand(30,70)}); return a;})();
const world={w:3400,h:3400}, cam={x:1700,y:1700};
let obstacles=(function(){ const a=[]; for(let i=0;i<120;i++) a.push({x:rand(260,world.w-260),y:rand(260,world.h-260),r:rand(40,140)}); return a;})();
function circleHit(ax,ay,ar,bx,by,br){ return (ax-bx)*(ax-bx)+(ay-by)*(ay-by) <= (ar+br)*(ar+br); }
function collideWithObstacles(o, obs, W,H){
  for(const ob of obs){ const dx=o.x-ob.x, dy=o.y-ob.y, d=Math.hypot(dx,dy);
    if(d < o.r+ob.r){ const ov=o.r+ob.r-d, nx=(dx/(d||1)), ny=(dy/(d||1)); o.x += nx*(ov+0.5); o.y += ny*(ov+0.5); }
  }
  o.x=clamp(o.x,o.r,W-o.r); o.y=clamp(o.y,o.r,H-o.r);
}

/* ======= Factions & Exfil ======= */
const factions=[
  {id:0,name:'Cyan',color:'#00f7ff',spawn:{x:480,y:3000}},
  {id:1,name:'Magenta',color:'#ff1cf7',spawn:{x:3000,y:520}},
  {id:2,name:'Amber',color:'#ffd166',spawn:{x:3000,y:3000}},
];
let exfil={x:380,y:600,r:90};

/* ======= Player & Inventory ======= */
const rarColors={common:'#b7c2d1',uncommon:'#68f8a7',rare:'#45c7ff',epic:'#ff84ff',legendary:'#ffd166'};
const player={x:baseWorld.w/2,y:baseWorld.h/2,r:14,angle:0,hp:100,speed:3.0,alive:true,kills:0,iFrames:0,knockX:0,knockY:0,knockT:0,healing:false,healProg:0,healNeed:1500};
let phase='base'; hud.phase.textContent='BASE';

const shop={ guns:{ melee:{cost:0}, ar:{cost:300}, sg:{cost:280}, dmr:{cost:360} }, ammoCost:1, medkitCost:60 };

let weapon = meleeWeapon(); // 默认近战
function meleeWeapon(){ return {id:'melee',name:'MELEE', melee:true, dmg:70, delay:360, range:60, arc:1.5}; }
function gunAR(res){ return {id:'ar',name:'AR', dmg:14, delay:110, spread:0.02, pellets:1, speed:8.2, magSize:30, mag:30, reserve:res, reloadTime:1200, reloading:false, reloadProg:0}; }
function gunSG(res){ return {id:'sg',name:'SG', dmg:7,  delay:500, spread:0.18, pellets:7, speed:7.0, magSize:6,  mag:6,  reserve:res, reloadTime:1600, reloading:false, reloadProg:0}; }
function gunDMR(res){return {id:'dmr',name:'DMR',dmg:36, delay:360, spread:0.006,pellets:1, speed:10.5,magSize:10, mag:10, reserve:res, reloadTime:1500, reloading:false, reloadProg:0}; }

const bullets=[]; // {x,y,vx,vy,r,dmg,life,team}
let enemies=[];   // {team,type,x,y,r,hp,speed,tick,gun,reloading,reloadProg,hitFlash}
let lootBags=[];  // {x,y,r,items[],opened}
let extractHold=0, extractNeed=180, extracting=false;

const inv={items:[], value:0, cap:12, medkit:false};
function usedCap(){ return inv.items.reduce((s,it)=>s+(it.size||1),0); }
function addTreasure(it){ const need=(it.size||1); if(usedCap()+need>inv.cap) return false; inv.items.push(it); inv.value += it.value||0; syncBagHud(); return true; }
function clearBag(){ inv.items=[]; inv.value=0; syncBagHud(); }
function syncBagHud(){ hud.tCnt.textContent=inv.items.length; hud.tVal.textContent=inv.value; hud.cap.textContent=usedCap()+"/"+inv.cap; }

/* ======= Input ======= */
const keys={}, mouse={x:W/2,y:H/2,down:false};
addEventListener('mousemove',e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
addEventListener('mousedown',()=> mouse.down=true);
addEventListener('mouseup',()=> mouse.down=false);
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(); keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key)) e.preventDefault();
  if(k==='r') startReload();
  if(k==='f') startHeal();
  if(k==='b') toggleBag();
  if(k==='e') interact();
});
addEventListener('keyup',e=> keys[e.key.toLowerCase()]=false);

/* ======= Interact ======= */
function interact(){
  if(phase==='base'){
    const p={x:player.x,y:player.y};
    for(const [key,z] of Object.entries(baseZones)){
      if(Math.hypot(z.x-p.x,z.y-p.y)<=z.r+12){
        if(key==='armory') openArmory();
        if(key==='warehouse') openWarehouse();
        if(key==='runway') startPreflight();
        return;
      }
    }
  }else if(phase==='combat' && player.alive){
    // loot
    let nearest=null, nd=999;
    for(const b of lootBags){ if(b.opened) continue; const d=Math.hypot(b.x-player.x,b.y-player.y); if(d<30&&d<nd){nd=d;nearest=b;} }
    if(nearest){ openLoot(nearest); return; }
    // exfil
    const d = Math.hypot(exfil.x-player.x, exfil.y-player.y);
    if(d<=exfil.r+12){ extracting=true; flashTip('按住 E 撤离中…'); }
  }
}

/* ======= Armory (Buy & Equip) ======= */
function currentWeaponChoice(){ return [...document.querySelectorAll('input[name="wep"]')].find(x=>x.checked).value; }
function recomputeBill(){
  const w = currentWeaponChoice();
  let costW = shop.guns[w].cost;
  const ammo = parseInt(ammoRange.value,10);
  const costAmmo = (w==='melee')?0: ammo * shop.ammoCost;
  const costMed = medkit.checked ? shop.medkitCost : 0;
  const total = costW + costAmmo + costMed;
  ammoLabel.textContent = ammo;
  billText.textContent = `余额：${credits} ｜ 结算：￥${total}（武器￥${costW} + 弹药￥${costAmmo} + 医疗￥${costMed}）`;
  ammoRange.disabled = (w==='melee');
  if(ammoRange.disabled) { ammoRange.value = 0; ammoLabel.textContent = 0; }
}
ammoRange.oninput=recomputeBill;
medkit.oninput=recomputeBill;
[...document.querySelectorAll('input[name="wep"]')].forEach(r=>r.oninput=recomputeBill);

armoryClose.onclick=()=> armoryUI.classList.remove('show');
armoryApply.onclick=()=>{
  const w = currentWeaponChoice();
  const ammo = parseInt(ammoRange.value,10);
  const costW = shop.guns[w].cost;
  const costAmmo = (w==='melee')?0: ammo*shop.ammoCost;
  const costMed = medkit.checked?shop.medkitCost:0;
  const total = costW + costAmmo + costMed;

  if(credits < total){
    flashTip('余额不足，已切换为免费近战入局');
    setWeapon('melee',0, false);
    armoryUI.classList.remove('show');
    return;
  }
  credits -= total; saveCredits();
  setWeapon(w, ammo, medkit.checked);
  armoryUI.classList.remove('show');
  flashTip('已购买并装配');
};
function openArmory(){ if(phase!=='base')return; creditsInUI.textContent=credits; armoryUI.classList.add('show'); recomputeBill(); }
function setWeapon(id,reserve,med){
  if(id==='melee'){ weapon=meleeWeapon(); hud.ammoText.textContent='—'; }
  if(id==='ar'){ weapon=gunAR(reserve); }
  if(id==='sg'){ weapon=gunSG(reserve); }
  if(id==='dmr'){ weapon=gunDMR(reserve); }
  inv.medkit = med;
  hud.wName.textContent = weapon.name;
  updateAmmoHud();
}

/* ======= Warehouse ======= */
warehouseClose.onclick=()=> warehouseUI.classList.remove('show');
sellAll.onclick=()=>{ credits += inv.value; saveCredits(); clearBag(); renderBagUI(); };
function openWarehouse(){ if(phase!=='base') return; renderBagUI(); warehouseUI.classList.add('show'); }
function renderBagUI(){
  creditsInUI.textContent = credits;
  bagList.innerHTML='';
  inv.items.forEach(it=>{
    const row=document.createElement('div'); row.className='rowi';
    const dot=`<span style="color:${rarColors[it.rar]||'#b7c2d1'}">●</span>`;
    row.innerHTML = `<div>${dot} ${it.name}</div><div>稀有度：${it.rar}</div><div>占用：${it.size||1}</div><div>价值：${it.value}</div>`;
    bagList.appendChild(row);
  });
  bagCap.textContent = usedCap()+"/"+inv.cap;
  bagVal.textContent = inv.value;
}
function toggleBag(){
  if(warehouseUI.classList.contains('show') || armoryUI.classList.contains('show') || lootUI.classList.contains('show')) return;
  renderBagUI(); warehouseUI.classList.add('show'); sellAll.style.display = phase==='base' ? 'inline-block' : 'none';
}

/* ======= Loot ======= */
let currentBag=null;
lootClose.onclick=()=>{ lootUI.classList.remove('show'); currentBag=null; };
takeAll.onclick=()=>{
  if(!currentBag) return;
  for(const it of [...currentBag.items]){
    if(it.t==='treasure'){ if(!addTreasure({rar:it.rar,name:it.name,value:it.value,size:it.size||1})) {flashTip('背包已满'); break;} }
    else if(it.t==='ammo'){ if(!weapon.melee){ weapon.reserve += it.ammo; } }
    else if(it.t==='med'){ inv.medkit=true; }
    currentBag.items.shift();
  }
  updateAmmoHud();
  if(currentBag.items.length===0){ currentBag.opened=true; lootUI.classList.remove('show'); currentBag=null; flashTip('已全部拾取'); }
};
function openLoot(bag){
  currentBag = bag;
  lootList.innerHTML='';
  bag.items.forEach((it,idx)=>{
    const row=document.createElement('div'); row.className='item';
    const left=document.createElement('div'); left.innerHTML=`<span class="rar ${it.rar}" style="color:${rarColors[it.rar]||'#b7c2d1'}">●</span> ${it.name} <span class="muted">（占用${it.size||1}）</span>`;
    const right=document.createElement('div');
    const btn=document.createElement('button'); btn.className='btn'; btn.textContent='拿走';
    btn.onclick=()=>{
      if(it.t==='treasure'){ if(!addTreasure({rar:it.rar,name:it.name,value:it.value,size:it.size||1})) return flashTip('背包容量不足'); }
      else if(it.t==='ammo'){ if(!weapon.melee) weapon.reserve += it.ammo; }
      else if(it.t==='med'){ inv.medkit=true; }
      bag.items.splice(idx,1); openLoot(bag);
    };
    if(it.t==='treasure'){ const val=document.createElement('span'); val.style.marginRight='8px'; val.textContent=`+${it.value}`; right.appendChild(val); }
    right.appendChild(btn); row.append(left,right); lootList.appendChild(row);
  });
  lootUI.classList.add('show');
  if(!bag.items.length){ bag.opened=true; lootUI.classList.remove('show'); currentBag=null; }
}

/* ======= Cinematic ======= */
function cinematic(duration=1800, dir='takeoff', cb=()=>{}){
  cin.classList.add('show');
  const start=performance.now();
  function draw(now){
    const t=now-start, pct=clamp(t/duration,0,1);
    ctx.save();
    const cx=W/2, cy=H/2;
    const x=cx + (dir==='takeoff'? lerp(-W*0.4, W*0.4, pct) : lerp(W*0.4, -W*0.4, pct));
    const y=cy + (dir==='takeoff'? lerp(-H*0.2, H*0.2, pct) : lerp(H*0.2, -H*0.2, pct));
    for(let i=0;i<60;i++){
      ctx.globalAlpha=0.15; ctx.strokeStyle=i%3?'#00f7ff':'#ff1cf7'; ctx.lineWidth=1+Math.random()*2;
      ctx.beginPath(); const sx=rand(0,W), sy=rand(0,H); ctx.moveTo(sx,sy); ctx.lineTo(sx+(dir==='takeoff'?40:-40), sy+rand(-10,10)); ctx.stroke();
    }
    ctx.globalAlpha=1; ctx.save(); ctx.translate(x,y); ctx.rotate(dir==='takeoff'?0.25:-2.9);
    ctx.fillStyle='#9ecbff'; ctx.shadowBlur=20; ctx.shadowColor='#9ecbff';
    ctx.beginPath(); ctx.moveTo(36,0); ctx.lineTo(-26,18); ctx.lineTo(-26,-18); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=0.8; ctx.fillStyle='#00f7ff'; ctx.shadowBlur=30; ctx.beginPath();
    ctx.ellipse(-28,0, 14, 6+Math.sin(now*0.02)*2, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore(); ctx.restore();
    if(t<duration) requestAnimationFrame(draw); else { cin.classList.remove('show'); cb(); }
  }
  requestAnimationFrame(draw);
}

/* ======= Match Flow ======= */
function startPreflight(){
  if(phase!=='base') return;
  flashTip('起飞准备：T-3…'); let c=3;
  const iv=setInterval(()=>{ c--; if(c>0) flashTip('起飞准备：T-'+c+'…'); else { clearInterval(iv); cinematic(1800,'takeoff', enterCombat); } }, 600);
}
function resetBattlefield(){
  lootBags.length=0; enemies.length=0;
  exfil.x = randi(200, world.w-200); exfil.y = randi(200, world.h-200);
  obstacles=(function(){ const a=[]; for(let i=0;i<120;i++) a.push({x:rand(260,world.w-260),y:rand(260,world.h-260),r:rand(40,140)}); return a;})();
  const squadsPerFaction = 4;
  for(const f of factions){
    for(let s=0;s<squadsPerFaction;s++){
      const squadSize = randi(3,6);
      const center = { x: f.spawn.x + rand(-160,160), y: f.spawn.y + rand(-160,160) };
      const type = choice(['grunt','grunt','raider','elite']);
      for(let i=0;i<squadSize;i++){
        const ang = Math.random()*Math.PI*2, rad = rand(0,40);
        const x = center.x + Math.cos(ang)*rad, y=center.y + Math.sin(ang)*rad;
        spawnEnemy(f.id, type, x, y, true);
      }
    }
  }
}
function enterCombat(){
  phase='combat'; hud.phase.textContent='COMBAT'; player.alive=true; player.hp=100; hud.hpFill.style.width=player.hp+'%'; hud.hpText.textContent=player.hp;
  player.kills=0; hud.kills.textContent=0;
  resetBattlefield();
  player.x = rand(700, world.w-700); player.y = rand(700, world.h-700);
  cam.x=player.x; cam.y=player.y;
  flashTip('已抵达战场：搜刮→撤离点。本局敌人数量已锁定；阵营互相开火！');
}
function returnToBase(){
  cinematic(1600,'land', ()=>{
    phase='base'; hud.phase.textContent='BASE';
    player.x=baseWorld.w/2; player.y=baseWorld.h/2;
    flashTip('已返航：去仓库出售战利品，或军械库买装备后再起飞。');
  });
}
function dieAndReturn(){ flashTip('阵亡，未撤离战利品已丢失'); clearBag(); returnToBase(); }

/* ======= Combat: Shoot / Reload / Heal / Melee ======= */
let lastShot=0;
function shoot(now){
  // 近战：在战场造成伤害；在基地只播放特效，便于试刀
  if(weapon.melee){
    if(now-lastShot<weapon.delay) return;
    lastShot=now;
    meleeAttack(phase!=='combat'); // base: visual only
    return;
  }

  if(phase!=='combat' || !player.alive || player.healing) return;
  if(weapon.reloading) return;
  if(weapon.mag<=0){ startReload(); return; }
  if(now-lastShot<weapon.delay) return;
  lastShot = now; weapon.mag--; updateAmmoHud();
  for(let p=0;p<weapon.pellets;p++){
    const spread = (Math.random()-0.5)*weapon.spread*Math.PI*2;
    const ang = player.angle + spread;
    bullets.push({ x:player.x + Math.cos(ang)*player.r*0.9, y:player.y + Math.sin(ang)*player.r*0.9,
                   vx:Math.cos(ang)*weapon.speed, vy:Math.sin(ang)*weapon.speed, r:3, dmg:weapon.dmg, life:150, team:-1 });
  }
}
function spawnSparks(x,y,color='#9ecbff',n=12){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=rand(2.4,5.8);
    sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,dur:220,color});
  }
}
function meleeAttack(visualOnly=false){
  // 加入刀光与冲击波
  slashFX.push({
    x:player.x,
    y:player.y,
    angle:player.angle,
    t:0,
    dur:260,
    r:weapon.range+24,
    arc:weapon.arc,
    flare:rand(0.85,1.25)
  });
  spawnSparks(player.x + Math.cos(player.angle)*(weapon.range*0.55),
              player.y + Math.sin(player.angle)*(weapon.range*0.55),
              '#5dfffb', 8);
  addShake(14,180);

  if(visualOnly) return;

  let hits=0;
  for(const e of enemies){
    const dx=e.x-player.x, dy=e.y-player.y, d=Math.hypot(dx,dy);
    if(d <= weapon.range + e.r){
      const angTo = Math.atan2(dy,dx);
      let da = Math.abs(((angTo - player.angle + Math.PI*3)%(Math.PI*2))-Math.PI);
      if(da <= weapon.arc*0.5){
        e.hp -= weapon.dmg;
        const nx=dx/(d||1), ny=dy/(d||1);
        e.x += nx*8; e.y += ny*8;
        e.hitFlash = 140;
        spawnSparks(e.x+nx*e.r*0.6, e.y+ny*e.r*0.6, '#ff84ff', 18);
        hits++;
        if(e.hp<=0){ spawnLootBag(e.x,e.y,e.type); enemies.splice(enemies.indexOf(e),1); player.kills++; hud.kills.textContent=player.kills; }
      }
    }
  }
  if(hits>0) flashTip(`挥砍命中 x${hits}`);
}
function startReload(){
  if(weapon.melee) return;
  if(weapon.reloading) return;
  if(weapon.mag>=weapon.magSize) return;
  if(weapon.reserve<=0) return;
  weapon.reloading=true; weapon.reloadProg=0; flashTip('换弹中…');
}
function doReload(dt){
  if(weapon.melee || !weapon.reloading) return;
  weapon.reloadProg += dt;
  if(weapon.reloadProg>=weapon.reloadTime){
    const need = Math.min(weapon.magSize-weapon.mag, weapon.reserve);
    weapon.mag += need; weapon.reserve -= need;
    weapon.reloading=false; weapon.reloadProg=0; updateAmmoHud(); flashTip('换弹完成');
  }
}
function startHeal(){
  if(!inv.medkit || player.healing || !player.alive || phase!=='combat') return;
  player.healing=true; player.healProg=0; flashTip('打药中…保持原地');
}
function doHeal(dt){
  if(!player.healing) return;
  player.healProg += dt;
  if(player.healProg>=player.healNeed){
    inv.medkit=false; player.healing=false;
    player.hp = clamp(player.hp+40,0,100);
    hud.hpFill.style.width = player.hp+'%'; hud.hpText.textContent=Math.round(player.hp);
    flashTip('治疗完成 +40HP');
  }
}
function updateAmmoHud(){
  if(weapon.melee) hud.ammoText.textContent='—';
  else hud.ammoText.textContent = `${weapon.mag}/${weapon.reserve}`;
  hud.wName.textContent = weapon.name;
}

/* ======= Enemies / Loot ======= */
function enemyGun(type){
  if(type==='grunt') return { dmg:7, speed:6.5, spread:0.08, delay:550, magSize:8,  mag:8,  reload:1100, range:520,  last:0 };
  if(type==='raider')return { dmg:9, speed:7.0, spread:0.06, delay:420, magSize:12, mag:12, reload:1200, range:620,  last:0 };
  if(type==='elite') return { dmg:12,speed:8.5, spread:0.04, delay:360, magSize:10, mag:10, reload:1400, range:720,  last:0 };
}
function spawnEnemy(teamId, type, x=null, y=null, placeExact=false){
  const sp = factions.find(f=>f.id===teamId).spawn;
  const px = x ?? (sp.x + rand(-80,80)), py = y ?? (sp.y + rand(-80,80));
  const base = type==='grunt'?{r:12,hp:28,speed:1.6}: type==='raider'?{r:13,hp:48,speed:2.1}:{r:16,hp:85,speed:1.7};
  const e={team:teamId, type, x:px, y:py, ...base, tick:0, gun:enemyGun(type), reloading:false, reloadProg:0, hitFlash:0};
  if(!placeExact){
    for(let k=0;k<10;k++){
      let overlapped=false;
      for(const other of enemies){
        const d=Math.hypot(e.x-other.x,e.y-other.y);
        if(d < e.r+other.r+4){ overlapped=true; const nx=(e.x-other.x)/(d||1), ny=(e.y-other.y)/(d||1); e.x+=nx*6; e.y+=ny*6; }
      }
      if(!overlapped) break;
    }
  }
  enemies.push(e);
}
function rollTreasureByType(type){
  const loot=[]; const push=(rar,name,value,size)=>loot.push({t:'treasure',rar,name,value,size});
  const ammo=(c,a)=>{ if(Math.random()<c) loot.push({t:'ammo',name:`弹药 +${a}`,rar:'common',value:0,ammo:a}); };
  const med =(c)=>{ if(Math.random()<c) loot.push({t:'med',name:`医疗包`,rar:'uncommon',value:0}); };
  if(type==='grunt'){ push('common','废料数据片', randi(10,25),1); if(Math.random()<0.35) push('uncommon','安全芯片', randi(25,45),1); ammo(0.55,randi(10,25)); }
  if(type==='raider'){ push('uncommon','蓝级战术模块', randi(40,70),2); if(Math.random()<0.4) push('rare','加密晶体', randi(80,120),2); ammo(0.65,randi(15,35)); med(0.18); }
  if(type==='elite'){ push('rare','原型体固件', randi(120,180),2); if(Math.random()<0.4) push('epic','遗迹权杖碎片', randi(180,260),3); if(Math.random()<0.12) push('legendary','星铸徽记', randi(320,500),3); ammo(0.8,randi(20,45)); med(0.28); }
  return loot;
}
function spawnLootBag(x,y,type){ const items=rollTreasureByType(type); if(items.length) lootBags.push({x,y,r:10,items,opened:false}); }
function pickTargetFor(e){
  let best=null, bd=1e9;
  if(player.alive){ const dp=Math.hypot(player.x-e.x,player.y-e.y); if(dp<bd){ bd=dp; best={type:'player'}; } }
  for(const other of enemies){ if(other===e) continue; if(other.team!==e.team){ const d=Math.hypot(other.x-e.x,other.y-e.y); if(d<bd){ bd=d; best={type:'enemy',idx:enemies.indexOf(other)}; } } }
  return best;
}

/* ======= Tips ======= */
let tipTimer=0; function flashTip(t){ hud.tip.textContent=t; tipTimer=200; }

/* ======= Main Loop ======= */
let last=performance.now(), fps=0, frames=0, fpsTimer=0;
requestAnimationFrame(loop);
function loop(now){
  const dt=now-last; last=now; fpsTimer+=dt; frames++; if(fpsTimer>=500){ fps=Math.round(frames*1000/fpsTimer); hud.fps.textContent='FPS '+fps; fpsTimer=0; frames=0; }
  drawBG(dt, now);
  if(phase==='base'){ updateBase(dt); renderBase(); }
  else if(phase==='combat'){ updateCombat(now,dt); renderCombat(now,dt); }
  if(shakeT>0){ shakeT=Math.max(0, shakeT-dt); if(shakeT===0) shakeMag=0; }
  if(tipTimer>0){ tipTimer--; if(tipTimer===0) hud.tip.textContent='基地：E交互；战场：左键射击/挥砍 R换弹 F打药 E交互 B背包'; }
  requestAnimationFrame(loop);
}

/* ======= Base ======= */
function updateBase(dt){
  let vx=(keys['d']?1:0)-(keys['a']?1:0), vy=(keys['s']?1:0)-(keys['w']?1:0);
  const len=Math.hypot(vx,vy)||1; vx/=len; vy/=len;
  player.x+=vx*player.speed*dt*0.1; player.y+=vy*player.speed*dt*0.1;
  collideWithObstacles(player, baseObstacles, baseWorld.w, baseWorld.h);
  const wm={x:baseCam.x - W/2 + mouse.x, y: baseCam.y - H/2 + mouse.y}; player.angle=Math.atan2(wm.y-player.y, wm.x-player.x);
  baseCam.x=lerp(baseCam.x,player.x,0.12); baseCam.y=lerp(baseCam.y,player.y,0.12);
  hud.hpFill.style.width=player.hp+'%'; hud.hpText.textContent=Math.round(player.hp);
  hud.phase.textContent='BASE';
}
function renderBase(){
  ctx.save();
  // 允许在基地体验刀光（视觉）：把镜头轻微抖动
  let ox=0, oy=0; if(shakeT>0){ const s=shakeMag*(shakeT/200); ox=(Math.random()-0.5)*s; oy=(Math.random()-0.5)*s; }
  ctx.translate(Math.round(W/2-baseCam.x+ox),Math.round(H/2-baseCam.y+oy));
  for(const o of baseObstacles){ neonCircle(o.x,o.y,o.r,'#2246ff',0.06,10); }
  for(const z of Object.values(baseZones)){ neonCircle(z.x,z.y,z.r, z.label==='Runway'?'#68f8a7':(z.label==='Armory'?'#00f7ff':'#ffd166'),0.08,14);
    ctx.save(); ctx.fillStyle='#bfe3ff'; ctx.shadowBlur=10; ctx.shadowColor='#bfe3ff'; ctx.font='14px monospace'; ctx.fillText(z.label, z.x-24, z.y+4); ctx.restore();
  }
  // 基地里也渲染刀光/火花（纯视觉）
  renderSlashAndSparks(16);
  neonCircle(player.x,player.y,player.r,'#00f7ff',0.09,18); neonWedge(player.x,player.y,player.r,player.angle,'#68f8a7');
  ctx.restore();
}

/* ======= Combat ======= */
function updateCombat(now,dt){
  if(player.alive){
    if(!player.healing){
      let vx=(keys['d']?1:0)-(keys['a']?1:0), vy=(keys['s']?1:0)-(keys['w']?1:0);
      const len=Math.hypot(vx,vy)||1; vx/=len; vy/=len;
      player.x += vx*player.speed*dt*0.1; player.y += vy*player.speed*dt*0.1;
    }
    const wm={x:cam.x - W/2 + mouse.x, y: cam.y - H/2 + mouse.y}; player.angle=Math.atan2(wm.y-player.y, wm.x-player.x);
    if(player.knockT>0){ player.x+=player.knockX; player.y+=player.knockY; player.knockT-=dt; }
    collideWithObstacles(player, obstacles, world.w, world.h);
    if(mouse.down) shoot(now);
    doReload(dt); doHeal(dt);
    if(player.iFrames>0) player.iFrames-=dt;
  }

  // Bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.x+=b.vx; b.y+=b.vy; b.life--;
    for(const o of obstacles){ if(circleHit(b.x,b.y,b.r,o.x,o.y,o.r)){ b.life=0; break; } }
    if(b.life<=0 || b.x<0||b.y<0||b.x>world.w||b.y>world.h){ bullets.splice(i,1); continue; }
    if(b.team===-1){
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j]; if(circleHit(b.x,b.y,b.r,e.x,e.y,e.r)){ e.hp-=b.dmg; b.life=0;
          if(e.hp<=0){ spawnLootBag(e.x,e.y,e.type); enemies.splice(j,1); player.kills++; hud.kills.textContent=player.kills; }
          break;
        }
      }
    }else{
      if(player.alive && circleHit(b.x,b.y,b.r,player.x,player.y,player.r)){
        player.hp = clamp(player.hp - b.dmg, 0, 100);
        hud.hpFill.style.width = player.hp+'%'; hud.hpText.textContent=Math.round(player.hp);
        b.life=0; if(player.hp<=0){ player.alive=false; corpses.push({x:player.x,y:player.y,angle:player.angle,time:Date.now()}); saveCorpses(); dieAndReturn(); }
      } else {
        for(let j=enemies.length-1;j>=0;j--){
          const e=enemies[j]; if(e.team===b.team) continue;
          if(circleHit(b.x,b.y,b.r,e.x,e.y,e.r)){ e.hp-=b.dmg; b.life=0; if(e.hp<=0){ spawnLootBag(e.x,e.y,e.type); enemies.splice(j,1); } break; }
        }
      }
    }
  }

  // Enemies AI + Reload + Touch damage
  for(const e of enemies){
    e.tick++;
    const tgt = pickTargetFor(e);
    let tx=e.x, ty=e.y;
    if(tgt){ if(tgt.type==='player'){ tx=player.x; ty=player.y; } else { const other=enemies[tgt.idx]; if(other){ tx=other.x; ty=other.y; } } }
    const dx=tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy)||1, ax=dx/d, ay=dy/d;
    const jitter = e.type==='raider'?0.45:0.3, mult = e.type==='elite'?0.8:1.0;
    e.x += (ax*e.speed + Math.cos(e.tick*0.07)*jitter)*mult;
    e.y += (ay*e.speed + Math.sin(e.tick*0.08)*jitter)*mult;
    collideWithObstacles(e, obstacles, world.w, world.h);

    if(player.alive && Math.hypot(player.x-e.x, player.y-e.y) < e.r + player.r + 2){
      if(player.iFrames<=0){
        player.hp = clamp(player.hp-12,0,100);
        hud.hpFill.style.width = player.hp+'%'; hud.hpText.textContent=Math.round(player.hp);
        const kx=-(ax)*0.9, ky=-(ay)*0.9; player.knockX=kx; player.knockY=ky; player.knockT=200; player.iFrames=2000;
        if(player.hp<=0){ player.alive=false; corpses.push({x:player.x,y:player.y,angle:player.angle,time:Date.now()}); saveCorpses(); dieAndReturn(); }
      }
    }

    const gun=e.gun;
    if(e.reloading){ e.reloadProg+=dt; if(e.reloadProg>=gun.reload){ e.reloading=false; e.reloadProg=0; gun.mag=gun.magSize; } }
    else{
      if(gun.mag<=0){ e.reloading=true; e.reloadProg=0; }
      else if(tgt && d <= gun.range && now-(gun.last||0) >= gun.delay){
        gun.last=now; gun.mag--;
        const ang = Math.atan2(ty-e.y, tx-e.x) + (Math.random()-0.5)*gun.spread;
        bullets.push({ x:e.x+Math.cos(ang)*e.r*0.9, y:e.y+Math.sin(ang)*e.r*0.9, vx:Math.cos(ang)*gun.speed, vy:Math.sin(ang)*gun.speed,
                       r:3, dmg:gun.dmg, life:150, team:e.team });
      }
    }
    if(e.hitFlash>0) e.hitFlash-=dt;
  }

  // 敌人与敌人之间的碰撞分离
  for(let i=0;i<enemies.length;i++){
    for(let j=i+1;j<enemies.length;j++){
      const a=enemies[i], b=enemies[j];
      const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1;
      const sumR=a.r+b.r;
      if(d < sumR){
        const ov=sumR-d+0.5, nx=dx/d, ny=dy/d;
        a.x -= nx*ov*0.5; a.y -= ny*ov*0.5;
        b.x += nx*ov*0.5; b.y += ny*ov*0.5;
      }
    }
  }

  // 挥砍 FX 更新
  for(const s of slashFX){ s.t+=dt; }
  slashFX = slashFX.filter(s=> s.t < s.dur);
  for(const sp of sparks){ sp.t+=dt; sp.x+=sp.vx; sp.y+=sp.vy; sp.vx*=0.96; sp.vy*=0.96; }
  sparks = sparks.filter(sp=> sp.t < sp.dur);
  // Exfil hold
  const d = Math.hypot(exfil.x-player.x, exfil.y-player.y);
  if(d<=exfil.r+12){
    if(keys['e']||extracting){ extractHold=clamp(extractHold+1,0,extractNeed); extracting=true; }
    else extractHold=clamp(extractHold-2,0,extractNeed);
    if(extractHold>=extractNeed){ extracting=false; extractHold=0; returnToBase(); }
  }else{ extracting=false; extractHold=clamp(extractHold-3,0,extractNeed); }

  cam.x=lerp(cam.x,player.x,0.12); cam.y=lerp(cam.y,player.y,0.12);
  hud.phase.textContent='COMBAT';
}

/* ======= Render Combat ======= */
function renderSlashAndSparks(glow=20){
  // 刀光
  for(const s of slashFX){
    const pct = s.t/s.dur; // 0..1
    const aStart = s.angle - s.arc/2;
    const aNow   = aStart + s.arc*pct;
    const r = s.r;
    const flare = s.flare || 1;
    const baseGlow = glow*(1+0.28*flare);

    // 背板：淡色扇形
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.24*(1-pct);
    ctx.fillStyle = '#00f7ff';
    ctx.shadowBlur = baseGlow; ctx.shadowColor='#00f7ff';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.arc(s.x, s.y, r, aStart, aNow, false);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 刀锋轨迹：亮色弧线
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.95*(1-pct);
    ctx.lineWidth = 6.5;
    ctx.strokeStyle = '#ff1cf7';
    ctx.shadowBlur = baseGlow*1.2; ctx.shadowColor='#ff1cf7';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, aNow-0.12, aNow+0.02, false);
    ctx.stroke();
    ctx.restore();

    // 刀锋内核：细亮线
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85*(1-pct);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#fef2ff';
    ctx.shadowBlur = baseGlow*0.9; ctx.shadowColor='#fef2ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r-8, aNow-0.09, aNow, false);
    ctx.stroke();
    ctx.restore();

    // 残像拖尾
    if(pct<0.85){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22*(1-pct);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#08f7ff';
      ctx.shadowBlur = baseGlow*0.7; ctx.shadowColor='#08f7ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, r*0.82, aStart, aStart + s.arc*Math.max(0,pct-0.08), false);
      ctx.stroke();
      ctx.restore();
    }

    // 冲击波：短暂扩散环
    if(pct<0.35){
      ctx.save();
      ctx.globalAlpha = (0.35-pct)*1.6;
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = '#68f8a7'; ctx.shadowBlur = baseGlow; ctx.shadowColor='#68f8a7';
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(s.angle)*24, s.y + Math.sin(s.angle)*24, 12 + pct*32, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 火花
  for(const sp of sparks){
    const alpha = 1 - sp.t/sp.dur;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = sp.color; ctx.shadowColor = sp.color; ctx.shadowBlur = glow*0.8;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function renderCombat(now,dt){
  ctx.save();
  // 屏幕抖动
  let ox=0, oy=0; if(shakeT>0){ const s=shakeMag*(shakeT/200); ox=(Math.random()-0.5)*s; oy=(Math.random()-0.5)*s; }
  ctx.translate(Math.round(W/2 - cam.x + ox), Math.round(H/2 - cam.y + oy));

  for(const o of obstacles){ neonCircle(o.x,o.y,o.r,'#2246ff',0.06,10); }
  for(const f of factions){ neonCircle(f.spawn.x,f.spawn.y, 90, f.color, 0.06, 12); }
  neonCircle(exfil.x,exfil.y, exfil.r, '#68f8a7', 0.08, 18);
  if(extractHold>0){
    const pct=extractHold/extractNeed; ctx.save(); ctx.strokeStyle='#68f8a7'; ctx.lineWidth=4; ctx.shadowBlur=12; ctx.shadowColor='#68f8a7';
    ctx.beginPath(); ctx.arc(exfil.x, exfil.y, exfil.r+12, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct); ctx.stroke(); ctx.restore();
  }
  for(const c of corpses){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.angle||0); ctx.shadowBlur=10; ctx.shadowColor='#9aa7b8'; ctx.strokeStyle='#b7c2d1'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.moveTo(0,-10); ctx.lineTo(0,10); ctx.stroke(); ctx.restore();
  }
  for(const b of lootBags){ neonCircle(b.x,b.y,b.r, b.opened ? '#9aa7b844' : '#ffd166', b.opened?0.05:0.18, 12); }
  for(const b of bullets){ const col = b.team===-1 ? '#00f7ff' : factions[b.team]?.color || '#ff6b6b'; neonCircle(b.x,b.y,b.r, col, 0.35, 16); }

  // 敌人（命中闪烁）
  for(const e of enemies){
    const col=factions[e.team].color;
    neonCircle(e.x,e.y,e.r, col, 0.10, 16);
    if(e.hitFlash>0){
      const a=e.hitFlash/140;
      ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3; ctx.shadowBlur=16; ctx.shadowColor='#ffffff';
      ctx.beginPath(); ctx.arc(e.x,e.y,e.r+6,0,Math.PI*2); ctx.stroke(); ctx.restore();
    }
  }

  // 刀光/火花在敌人与玩家之间渲染，获得穿透感
  renderSlashAndSparks(20);

  if(player.alive){
    neonCircle(player.x,player.y,player.r,'#00f7ff',0.09,18);
    neonWedge(player.x,player.y,player.r,player.angle,'#68f8a7');
    if(weapon.reloading){
      const pct=clamp(weapon.reloadProg/weapon.reloadTime,0,1);
      ctx.save(); ctx.strokeStyle='#00f7ff'; ctx.lineWidth=3; ctx.shadowBlur=10; ctx.shadowColor='#00f7ff';
      ctx.beginPath(); ctx.arc(player.x, player.y, player.r+12, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct); ctx.stroke(); ctx.restore();
    }
    if(player.healing){
      const pct=clamp(player.healProg/player.healNeed,0,1);
      ctx.save(); ctx.strokeStyle='#68f8a7'; ctx.lineWidth=4; ctx.shadowBlur=12; ctx.shadowColor='#68f8a7';
      ctx.beginPath(); ctx.arc(player.x, player.y, player.r+18, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct); ctx.stroke(); ctx.restore();
    }
    if(player.iFrames>0){ ctx.save(); ctx.globalAlpha=0.25+0.25*Math.sin(now*0.02); neonCircle(player.x,player.y,player.r+6,'#ffffff',0.08,12); ctx.restore(); }
  }
  ctx.globalCompositeOperation='destination-in';
  const g=ctx.createRadialGradient(player.x,player.y,90, player.x,player.y,450);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.fillRect(cam.x-W/2, cam.y-H/2, W, H);
  ctx.restore();
}

/* ======= Bind ======= */
addEventListener('mousedown', ()=>{ shoot(performance.now()); });

/* ======= HUD init ======= */
hud.hpFill.style.width = player.hp+'%'; hud.hpText.textContent = player.hp;
hud.wName.textContent = weapon.name; updateAmmoHud(); syncBagHud();

})();
