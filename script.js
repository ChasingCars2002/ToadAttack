(() => {
  class RNG { constructor(seed=1337){this.seed=seed>>>0;} next(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;} int(a,b){return Math.floor(this.next()*(b-a+1))+a;} pick(arr){return arr[Math.floor(this.next()*arr.length)];} }
  const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
  const ui={lives,cash,wave,relicCount,rewardModal,rewardCards,selectedInfo,pauseBtn,speedBtn,nextWaveBtn,restartBtn,towerBar,abilityBtn,upgradeBtn,sellBtn};
  const towerDefs={
    Dart:{cost:60,range:95,rate:0.8,dmg:1.2,color:'#89d6ff',tip:'Fast all-rounder.'},
    Cannon:{cost:90,range:85,rate:1.6,dmg:3.8,color:'#f3ad59',tip:'AOE splash shots.'},
    Glue:{cost:70,range:105,rate:1.0,dmg:0.5,color:'#8cf06a',tip:'Slows and weakens.'},
    Ice:{cost:85,range:95,rate:1.2,dmg:0.8,color:'#c6f6ff',tip:'Freeze control.'},
    Laser:{cost:120,range:130,rate:0.45,dmg:1.7,color:'#ff7ef1',tip:'High precision beam.'}
  };

  let state;
  function init(seed=4242){
    const rng=new RNG(seed);
    state={rng,wave:1,lives:30,cash:120,paused:false,speed:1,path:genPath(rng),towers:[],enemies:[],projectiles:[],particles:[],nums:[],relics:[],spawnQ:[],waveActive:false,selected:'Dart',selectedTower:null,dragPos:null,shake:0,combo:0,ability:0,nextWaveTimer:7,bgStars:genStars(rng)};
    renderTowerButtons();updateUI();
  }
  function genStars(rng){return Array.from({length:70},()=>({x:rng.next()*900,y:rng.next()*520,r:rng.next()*1.8+0.4,s:rng.next()*0.4+0.1}));}
  function genPath(rng){const pts=[{x:0,y:260}],segments=8;let y=260;for(let i=1;i<segments;i++){y=Math.max(40,Math.min(480,y+rng.int(-95,95)));pts.push({x:(i/segments)*900,y});}pts.push({x:900,y:rng.int(80,440)});return pts;}
  function spawnWave(){if(state.waveActive) return;state.waveActive=true;state.spawnQ=[];state.nextWaveTimer=0;const count=11+state.wave*4;for(let i=0;i<count;i++){const t=enemyType();state.spawnQ.push({delay:i*0.55,type:t});}if(state.wave%5===0) state.spawnQ.push({delay:count*0.55+0.3,type:'boss',boss:true});}
  function enemyType(){const w=state.wave,roll=state.rng.next();if(w>3&&roll<0.18)return 'fast';if(w>5&&roll<0.35)return 'armored';if(w>8&&roll<0.52)return 'splitter';if(w>10&&roll<0.7)return 'regen';if(w>12&&roll<0.82)return 'camo';if(w>14&&roll<0.9)return 'shielded';return 'basic';}
  function spawnEnemy(type,boss=false){const base={basic:[24,.9,1],fast:[16,1.65,1],armored:[52,.65,3.6],splitter:[20,1.05,1],regen:[30,.95,1.4],camo:[20,1.2,1],shielded:[34,1,2.2],boss:[280,.62,5.2]};const [hp,spd,arm]=base[type]||base.basic;const mult=1+state.wave*.2;state.enemies.push({type,hp:hp*mult,maxHp:hp*mult,speed:spd*(1+state.wave*0.026),armor:arm,pathI:0,t:0,x:0,y:260,slow:1,freeze:0,boss,shield:type==='shielded'?Math.round(16+state.wave*1.8):0});if(boss)state.shake=14;}

  function placeTower(x,y,name){const d=towerDefs[name];if(state.cash<d.cost||onPath(x,y))return;for(const t of state.towers){if(Math.hypot(t.x-x,t.y-y)<32)return;} state.cash-=d.cost;const tower={name,x,y,lvl:1,cd:0,range:d.range,rate:d.rate,dmg:d.dmg,kills:0,rank:1,mut:[]};state.towers.push(tower);state.selectedTower=tower;tryFusion(tower);updateUI();}
  function tryFusion(t){for(const o of state.towers){if(o===t)continue;if(Math.hypot(o.x-t.x,o.y-t.y)<55&&((o.name==='Glue'&&t.name==='Ice')||(o.name==='Dart'&&t.name==='Laser'))){t.mut.push('Fusion');o.mut.push('Fusion');t.dmg*=1.25;o.dmg*=1.25;state.nums.push({x:t.x,y:t.y,txt:'Fusion!',life:1.2,color:'#7cf'});return;}}}
  function onPath(x,y){for(let i=0;i<state.path.length-1;i++){const a=state.path[i],b=state.path[i+1];const l2=(b.x-a.x)**2+(b.y-a.y)**2;let u=((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/l2;u=Math.max(0,Math.min(1,u));const px=a.x+u*(b.x-a.x),py=a.y+u*(b.y-a.y);if(Math.hypot(px-x,py-y)<28)return true;}return false;}

  
  function pickTower(x,y){state.selectedTower=state.towers.find(t=>Math.hypot(t.x-x,t.y-y)<18)||null;updateUI();}
  function upgradeTower(){const t=state.selectedTower;if(!t)return;const cost=Math.floor(45+t.rank*22);if(state.cash<cost)return;state.cash-=cost;t.rank++;t.dmg*=1.14;t.range+=6;t.rate*=0.95;state.nums.push({x:t.x,y:t.y,txt:'Manual Upgrade!',life:1,color:'#9ff'});updateUI();}
  function sellTower(){const t=state.selectedTower;if(!t)return;const refund=Math.floor((towerDefs[t.name].cost+ t.rank*18)*0.65);state.cash+=refund;state.towers=state.towers.filter(x=>x!==t);state.selectedTower=null;updateUI();}

  function update(dt){if(state.paused)return;dt*=state.speed;state.shake=Math.max(0,state.shake-dt*12);state.ability=Math.min(100,state.ability+dt*6);
    if(!state.waveActive){state.nextWaveTimer-=dt;if(state.nextWaveTimer<=0)spawnWave();}
    for(const s of state.spawnQ)s.delay-=dt;while(state.spawnQ[0]&&state.spawnQ[0].delay<=0){const s=state.spawnQ.shift();spawnEnemy(s.type,s.boss);}
    for(const e of state.enemies){if(e.freeze>0){e.freeze-=dt;continue;}const a=state.path[e.pathI],b=state.path[e.pathI+1];if(!b){state.lives-=e.boss?5:1;e.dead=true;continue;}const seg=Math.hypot(b.x-a.x,b.y-a.y);e.t+=(e.speed*e.slow*dt*45)/seg;while(e.t>=1){e.t-=1;e.pathI++;if(!state.path[e.pathI+1])break;}const c=state.path[e.pathI],d=state.path[e.pathI+1]||c;e.x=c.x+(d.x-c.x)*e.t;e.y=c.y+(d.y-c.y)*e.t;if(e.type==='regen'&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+dt*.95);e.slow=Math.min(1,e.slow+dt*0.7);}
    for(const t of state.towers){t.cd-=dt;if(t.cd<=0){const target=state.enemies.filter(e=>!e.dead&&Math.hypot(e.x-t.x,e.y-t.y)<=t.range).sort((a,b)=>b.pathI-a.pathI||a.hp-b.hp)[0];if(target){shoot(t,target);t.cd=t.rate*Math.max(0.62,1-t.rank*0.04);}}}
    for(const p of state.projectiles){p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.life-=dt;const hit=state.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<10);if(hit){damage(hit,p.dmg,p.type,p.owner);if(p.splash) splashDamage(hit,p.splash,p.owner);p.life=0;}if(p.life<=0)p.dead=true;}
    state.enemies=state.enemies.filter(e=>!e.dead&&e.hp>0);state.projectiles=state.projectiles.filter(p=>!p.dead);state.particles=state.particles.filter(p=>(p.life-=dt)>0);state.nums=state.nums.filter(n=>(n.life-=dt)>0).map(n=>(n.y-=dt*18,n));
    if(state.waveActive&&state.spawnQ.length===0&&state.enemies.length===0){state.waveActive=false;state.nextWaveTimer=6;if(state.wave>=20){alert('Victory! Toad realm secured.');state.paused=true;return;}rewardPhase();}
    if(state.lives<=0){alert('Defeat!');state.paused=true;}updateUI();
  }
  function splashDamage(origin,baseDmg,owner){for(const e of state.enemies){const d=Math.hypot(e.x-origin.x,e.y-origin.y);if(d<45&&!e.dead){damage(e,baseDmg*(1-d/50),'Cannon',owner);}}}
  function shoot(t,e){const dx=e.x-t.x,dy=e.y-t.y,m=Math.hypot(dx,dy)||1;state.projectiles.push({x:t.x,y:t.y,vx:dx/m*5.1,vy:dy/m*5.1,life:2,dmg:t.dmg*(1+t.rank*0.12),type:t.name,splash:t.name==='Cannon'?2.2:0,owner:t});}
  function levelTower(t){const target=8+t.rank*8;if(t.kills>=target){t.kills=0;t.rank++;t.dmg*=1.09;t.range+=3;state.nums.push({x:t.x,y:t.y,txt:`Rank ${t.rank}!`,life:1.1,color:'#ffd76b'});}}
  function damage(e,dmg,type,owner){let d=Math.max(.15,dmg-e.armor*.14);if(e.shield>0){const block=Math.min(e.shield,d*0.75);e.shield-=block;d-=block;}if(type==='Glue'){e.slow=.52;d*=.75;}if(type==='Ice'){e.freeze=.35;}if(type==='Laser')d*=1.08;
    e.hp-=d;state.nums.push({x:e.x,y:e.y,txt:d.toFixed(1),life:.6,color:'#fff'});for(let i=0;i<4;i++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*2.4,vy:(Math.random()-.5)*2.4,life:.4,c:'#b7d0ff'});
    if(e.hp<=0){state.cash+=5+Math.floor(state.wave*.65);state.combo=Math.min(30,state.combo+1);state.ability=Math.min(100,state.ability+2);if(owner){owner.kills++;levelTower(owner);}if(e.type==='splitter'&&!e.boss){for(let i=0;i<2;i++)spawnEnemy('fast');}e.dead=true;}
  }
  function rewardPhase(){ui.rewardModal.classList.remove('hidden');const opts=[];while(opts.length<3)opts.push(genReward());ui.rewardCards.innerHTML='';opts.forEach(o=>{const div=document.createElement('div');div.className='reward';div.innerHTML=`<h3>${o.title}</h3><p>${o.desc}</p>`;div.onclick=()=>{o.apply();ui.rewardModal.classList.add('hidden');state.wave++;updateUI();};ui.rewardCards.appendChild(div);});}
  function genReward(){const r=state.rng.next();if(r<.2){const key=state.rng.pick(Object.keys(towerDefs));return{title:`${key} Mastery`,desc:`All ${key} towers +14% damage.`,apply:()=>state.towers.filter(t=>t.name===key).forEach(t=>t.dmg*=1.14)};} if(r<.42){return{title:'Fortification',desc:'+4 lives and +40 gold.',apply:()=>{state.lives+=4;state.cash+=40;}};} if(r<.64){return{title:'Engineers',desc:'All towers gain 7 range and 6% fire rate.',apply:()=>state.towers.forEach(t=>{t.range+=7;t.rate*=.94;})};} if(r<.82){return{title:'Ancient Relic',desc:'+1 relic, global +5% damage.',apply:()=>{state.relics.push({});state.towers.forEach(t=>t.dmg*=1.05);}};} return{title:'Gold Cache',desc:'Gain 115 gold now.',apply:()=>state.cash+=115};}

  function useAbility(){if(state.ability<100)return;state.ability=0;state.shake=9;for(const e of state.enemies){if(e.boss)e.hp-=22;else e.hp-=45;e.freeze=Math.max(e.freeze,0.2);}state.nums.push({x:430,y:50,txt:'Rainstorm Surge!',life:1.4,color:'#8ff'});}
  function draw(){ctx.save();ctx.clearRect(0,0,900,520);
    for(const s of state.bgStars){s.x-=s.s*state.speed;if(s.x<0)s.x=900;ctx.fillStyle=`rgba(180,210,255,${0.25+s.r*0.2})`;ctx.fillRect(s.x,s.y,s.r,s.r);}
    if(state.shake>0)ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);
    ctx.lineWidth=40;ctx.strokeStyle='#3b2c27';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(state.path[0].x,state.path[0].y);for(const p of state.path.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.lineWidth=26;ctx.strokeStyle='#87624a';ctx.stroke();
    for(const t of state.towers){ctx.fillStyle='#0007';ctx.beginPath();ctx.arc(t.x+2,t.y+2,14,0,7);ctx.fill();ctx.fillStyle=towerDefs[t.name].color;ctx.beginPath();ctx.arc(t.x,t.y,13,0,7);ctx.fill();if(state.selectedTower===t){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x,t.y,16,0,7);ctx.stroke();}ctx.fillStyle='#001';ctx.fillText(String(t.rank),t.x-3,t.y+4);} 
    if(state.dragPos){ctx.strokeStyle='#8ff';ctx.beginPath();ctx.arc(state.dragPos.x,state.dragPos.y,towerDefs[state.selected].range,0,7);ctx.stroke();}
    for(const e of state.enemies){ctx.fillStyle=e.boss?'#ff5151':({basic:'#9ee',fast:'#f9e',armored:'#999',splitter:'#9f9',regen:'#7f7',camo:'#59607c',shielded:'#89a7ff'})[e.type]||'#fff';ctx.beginPath();ctx.arc(e.x,e.y,e.boss?17:9,0,7);ctx.fill();if(e.shield>0){ctx.strokeStyle='#9fc0ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,12,0,7);ctx.stroke();}
      ctx.fillStyle='#111';ctx.fillRect(e.x-10,e.y-15,20,3);ctx.fillStyle='#f44';ctx.fillRect(e.x-10,e.y-15,20*(e.hp/e.maxHp),3);}
    ctx.fillStyle='#fff';for(const p of state.projectiles){ctx.beginPath();ctx.arc(p.x,p.y,p.splash?4:3,0,7);ctx.fill();}
    for(const p of state.particles){ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,2,2);p.x+=p.vx;p.y+=p.vy;}
    for(const n of state.nums){ctx.fillStyle=n.color||'#ffd';ctx.fillText(n.txt,n.x,n.y);} 
    ctx.fillStyle='#9ad';ctx.fillRect(10,10,130,10);ctx.fillStyle='#63f5ff';ctx.fillRect(10,10,1.3*state.ability,10);ctx.strokeStyle='#dff';ctx.strokeRect(10,10,130,10);ctx.fillStyle='#dff';ctx.fillText('Storm',14,30);
    if(!state.waveActive&&state.nextWaveTimer>0){ctx.fillStyle='#d7e6ff';ctx.fillText(`Next wave in ${state.nextWaveTimer.toFixed(1)}s`,360,22);}ctx.restore();
  }
  function updateUI(){ui.lives.textContent=Math.max(0,Math.floor(state.lives));ui.cash.textContent=Math.floor(state.cash);ui.wave.textContent=`${state.wave}/20`;ui.relicCount.textContent=state.relics.length;const t=state.selectedTower;if(t){const uCost=Math.floor(45+t.rank*22);const sValue=Math.floor((towerDefs[t.name].cost+t.rank*18)*0.65);ui.selectedInfo.textContent=`${t.name} R${t.rank} | Dmg ${t.dmg.toFixed(1)} | Rng ${Math.round(t.range)} | Upgrade ${uCost} | Sell ${sValue}`;} else {ui.selectedInfo.textContent=`${state.selected}: ${towerDefs[state.selected].tip} | Cost ${towerDefs[state.selected].cost} | Combo ${state.combo}`;}ui.abilityBtn.textContent=`Storm ${Math.floor(state.ability)}%`;}
  function renderTowerButtons(){ui.towerBar.innerHTML='';Object.keys(towerDefs).forEach(k=>{const b=document.createElement('button');b.textContent=`${k} (${towerDefs[k].cost})`;b.onclick=()=>{state.selected=k;updateUI();};ui.towerBar.appendChild(b);});}

  let last=performance.now();function loop(ts){const dt=Math.min(.05,(ts-last)/1000);last=ts;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
  function pointerPos(ev){const r=canvas.getBoundingClientRect();const t=ev.touches?ev.touches[0]:ev;return{x:(t.clientX-r.left)/r.width*900,y:(t.clientY-r.top)/r.height*520};}
  canvas.addEventListener('pointerdown',e=>{const p=pointerPos(e);pickTower(p.x,p.y);state.dragPos=p;});canvas.addEventListener('pointermove',e=>{if(state.dragPos)state.dragPos=pointerPos(e);});canvas.addEventListener('pointerup',e=>{const p=pointerPos(e);placeTower(p.x,p.y,state.selected);state.dragPos=null;});
  window.addEventListener('keydown',e=>{if(e.code==='Space')useAbility();if(e.code==='KeyU')upgradeTower();if(e.code==='KeyS')sellTower();});
  ui.pauseBtn.onclick=()=>{state.paused=!state.paused;ui.pauseBtn.textContent=state.paused?'Resume':'Pause';}; ui.speedBtn.onclick=()=>{state.speed=state.speed===1?2:1;ui.speedBtn.textContent=state.speed===1?'x2':'x1';}; ui.nextWaveBtn.onclick=spawnWave; ui.restartBtn.onclick=()=>init(4242); ui.abilityBtn.onclick=useAbility; ui.upgradeBtn.onclick=upgradeTower; ui.sellBtn.onclick=sellTower;
  init();
})();
