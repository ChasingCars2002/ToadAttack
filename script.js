(() => {
  class RNG { constructor(seed=1337){this.seed=seed>>>0;} next(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;} int(a,b){return Math.floor(this.next()*(b-a+1))+a;} pick(arr){return arr[Math.floor(this.next()*arr.length)];} }
  const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
  const ui={lives:lives,cash:cash,wave:wave,relicCount,rewardModal,rewardCards,selectedInfo,pauseBtn,speedBtn,nextWaveBtn,restartBtn,towerBar};
  const towerDefs={
    Dart:{cost:60,range:95,rate:0.9,dmg:1,color:'#89d6ff',tip:'Fast all-rounder.',upgrades:['+1 dmg','+20 range','+20% atk spd','pierce +1','crit chance','rapid volley']},
    Cannon:{cost:90,range:85,rate:1.6,dmg:3,color:'#f3ad59',tip:'AOE splash.',upgrades:['+2 splash','+1 dmg','stun blast','armor shred','cluster shell','mega bomb']},
    Glue:{cost:70,range:100,rate:1.1,dmg:0.4,color:'#8cf06a',tip:'Slows and weakens.',upgrades:['+slow','longer glue','vuln debuff','spread goo','corrosive','sticky trap']},
    Ice:{cost:85,range:90,rate:1.3,dmg:0.7,color:'#c6f6ff',tip:'Freeze control.',upgrades:['freeze +0.2s','shatter dmg','chill aura','camo reveal','ice spikes','blizzard']},
    Laser:{cost:120,range:120,rate:0.5,dmg:1.5,color:'#ff7ef1',tip:'Precise beam.',upgrades:['+beam width','burn','chain arc','boss focus','overcharge','prism']}
  };
  const relicPool=Array.from({length:30},(_,i)=>({name:`Relic ${i+1}`,desc:['Toads gain +5% damage','+10 starting cash','+1 life each wave','+5% projectile speed','Bosses take +8% dmg'][i%5]}));
  const cursePool=Array.from({length:10},(_,i)=>({name:`Curse ${i+1}`,desc:['Enemies +10% speed','-1 life now','Shops cost +5%','Boss HP +12%','-5 starting cash'][i%5]}));

  let state;
  function init(seed=4242){
    const rng=new RNG(seed);
    state={rng,wave:1,lives:30,cash:120,paused:false,speed:1,path:genPath(rng),towers:[],enemies:[],projectiles:[],particles:[],nums:[],relics:[],curses:[],spawnQ:[],waveActive:false,selected:'Dart',dragPos:null,shake:0};
    renderTowerButtons();updateUI();
  }
  function genPath(rng){const pts=[{x:0,y:260}],segments=7;let y=260;for(let i=1;i<segments;i++){y=Math.max(40,Math.min(480,y+rng.int(-110,110)));pts.push({x:(i/segments)*900,y});}pts.push({x:900,y:rng.int(80,440)});return pts;}
  function spawnWave(){if(state.waveActive) return;state.waveActive=true;state.spawnQ=[];const count=10+state.wave*3;for(let i=0;i<count;i++){const t=enemyType();state.spawnQ.push({delay:i*0.7,type:t});}if([5,10,15,20].includes(state.wave)) state.spawnQ.push({delay:count*0.7+0.4,type:state.wave===20?'boss':'armored',boss:true});}
  function enemyType(){const w=state.wave;const types=['basic','fast','armored','splitter','regen','camo'];return types[Math.min(types.length-1,Math.floor((w-1)/4))];}
  function spawnEnemy(type,boss=false){const base={basic:[24,.9,1],fast:[16,1.5,1],armored:[46,.7,3],splitter:[20,1,1],regen:[26,.95,1],camo:[20,1.1,1],boss:[250,.6,5]};const [hp,spd,arm]=base[type]||base.basic;state.enemies.push({type,hp:hp*(1+state.wave*.18),maxHp:hp*(1+state.wave*.18),speed:spd*(1+state.wave*0.02),armor:arm,pathI:0,t:0,x:0,y:260,slow:1,freeze:0,boss});if(boss)state.shake=12;}
  function placeTower(x,y,name){const d=towerDefs[name];if(state.cash<d.cost)return;for(const t of state.towers){if(Math.hypot(t.x-x,t.y-y)<30)return;} if(onPath(x,y))return; state.cash-=d.cost;const tower={name,x,y,lvl:1,cd:0,range:d.range,rate:d.rate,dmg:d.dmg,mut:[]};state.towers.push(tower);tryFusion(tower);updateUI();}
  function tryFusion(t){for(const o of state.towers){if(o===t)continue;if(Math.hypot(o.x-t.x,o.y-t.y)<55&&((o.name==='Glue'&&t.name==='Ice')||(o.name==='Dart'&&t.name==='Laser'))){t.mut.push('Fusion');o.mut.push('Fusion');t.dmg*=1.2;o.dmg*=1.2;return;}}}
  function onPath(x,y){for(let i=0;i<state.path.length-1;i++){const a=state.path[i],b=state.path[i+1];const l2=(b.x-a.x)**2+(b.y-a.y)**2;let u=((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/l2;u=Math.max(0,Math.min(1,u));const px=a.x+u*(b.x-a.x),py=a.y+u*(b.y-a.y);if(Math.hypot(px-x,py-y)<28)return true;}return false;}
  function update(dt){if(state.paused)return;dt*=state.speed;state.shake=Math.max(0,state.shake-dt*12);
    for(const s of state.spawnQ)s.delay-=dt;while(state.spawnQ[0]&&state.spawnQ[0].delay<=0){const s=state.spawnQ.shift();spawnEnemy(s.type,s.boss);} 
    for(const e of state.enemies){if(e.freeze>0){e.freeze-=dt;continue;}const a=state.path[e.pathI],b=state.path[e.pathI+1];if(!b){state.lives-=e.boss?4:1;e.dead=true;continue;}const seg=Math.hypot(b.x-a.x,b.y-a.y);e.t+=(e.speed*e.slow*dt*45)/seg;while(e.t>=1){e.t-=1;e.pathI++;if(!state.path[e.pathI+1])break;}const c=state.path[e.pathI],d=state.path[e.pathI+1]||c;e.x=c.x+(d.x-c.x)*e.t;e.y=c.y+(d.y-c.y)*e.t;if(e.type==='regen'&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+dt*.8);e.slow=Math.min(1,e.slow+dt*0.6);}
    for(const t of state.towers){t.cd-=dt;if(t.cd<=0){const target=state.enemies.filter(e=>!e.dead&&Math.hypot(e.x-t.x,e.y-t.y)<=t.range).sort((a,b)=>b.pathI-a.pathI)[0];if(target){shoot(t,target);t.cd=t.rate;}}}
    for(const p of state.projectiles){p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;p.life-=dt;const hit=state.enemies.find(e=>!e.dead&&Math.hypot(e.x-p.x,e.y-p.y)<10);if(hit){damage(hit,p.dmg,p.type);p.life=0;}if(p.life<=0)p.dead=true;}
    state.enemies=state.enemies.filter(e=>!e.dead&&e.hp>0);state.projectiles=state.projectiles.filter(p=>!p.dead);state.particles=state.particles.filter(p=>(p.life-=dt)>0);state.nums=state.nums.filter(n=>(n.life-=dt)>0).map(n=>(n.y-=dt*18,n));
    if(state.waveActive&&state.spawnQ.length===0&&state.enemies.length===0){state.waveActive=false;if(state.wave>=20){alert('Victory! Goblins repelled.');state.paused=true;return;} rewardPhase();}
    if(state.lives<=0){alert('Defeat!');state.paused=true;}
    updateUI();
  }
  function shoot(t,e){const dx=e.x-t.x,dy=e.y-t.y,m=Math.hypot(dx,dy)||1;state.projectiles.push({x:t.x,y:t.y,vx:dx/m*4.5,vy:dy/m*4.5,life:2,dmg:t.dmg,type:t.name});}
  function damage(e,dmg,type){let d=Math.max(.1,dmg-e.armor*.15);if(type==='Glue'){e.slow=.55;d*=.7;}if(type==='Ice'){e.freeze=.3;}e.hp-=d;state.nums.push({x:e.x,y:e.y,txt:d.toFixed(1),life:.6});for(let i=0;i<5;i++)state.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*2,vy:(Math.random()-.5)*2,life:.35,c:'#fff'});
    if(e.hp<=0){state.cash+=4+Math.floor(state.wave*.6);if(e.type==='splitter'&&!e.boss){for(let i=0;i<2;i++)spawnEnemy('fast');}e.dead=true;}
  }
  function rewardPhase(){ui.rewardModal.classList.remove('hidden');const opts=[];while(opts.length<3){opts.push(genReward());}ui.rewardCards.innerHTML='';opts.forEach(o=>{const div=document.createElement('div');div.className='reward';div.innerHTML=`<h3>${o.title}</h3><p>${o.desc}</p>`;div.onclick=()=>{o.apply();ui.rewardModal.classList.add('hidden');state.wave++;updateUI();};ui.rewardCards.appendChild(div);});}
  function genReward(){const r=state.rng.next();if(r<.22){const key=state.rng.pick(Object.keys(towerDefs));return{title:`New ${key} Tower`,desc:`Unlock mutation for ${key} (+10% damage).`,apply:()=>{state.towers.filter(t=>t.name===key).forEach(t=>t.dmg*=1.1);}};} if(r<.44){return{title:'Upgrade Draft',desc:'+1 level to a random tower and +8% range.',apply:()=>{const t=state.rng.pick(state.towers);if(t){t.lvl++;t.range*=1.08;}}};} if(r<.63){const rel=state.rng.pick(relicPool);return{title:rel.name,desc:rel.desc,apply:()=>{state.relics.push(rel);if(rel.desc.includes('damage'))state.towers.forEach(t=>t.dmg*=1.05);}};} if(r<.78){const c=state.rng.pick(cursePool);return{title:c.name+' (Curse)',desc:c.desc+' Gain 65 cash.',apply:()=>{state.curses.push(c);state.cash+=65;}};} if(r<.9){return{title:'Treasure',desc:'Gain 90 cash.',apply:()=>state.cash+=90};} return{title:'Map Shift',desc:'Path bends. Enemies slower 8% this wave.',apply:()=>{state.path=genPath(state.rng);state.spawnQ.forEach(s=>s.delay*=1.08);}};}
  function draw(){ctx.save();ctx.clearRect(0,0,900,520);if(state.shake>0)ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);
    ctx.lineWidth=34;ctx.strokeStyle='#5a3b2e';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(state.path[0].x,state.path[0].y);for(const p of state.path.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
    ctx.lineWidth=24;ctx.strokeStyle='#8f5f46';ctx.stroke();
    for(const t of state.towers){ctx.fillStyle=towerDefs[t.name].color;ctx.beginPath();ctx.arc(t.x,t.y,13,0,7);ctx.fill();ctx.fillStyle='#0008';ctx.fillText(t.name[0],t.x-3,t.y+4);} 
    if(state.dragPos){ctx.strokeStyle='#8ff';ctx.beginPath();ctx.arc(state.dragPos.x,state.dragPos.y,towerDefs[state.selected].range,0,7);ctx.stroke();}
    for(const e of state.enemies){ctx.fillStyle=e.boss?'#ff5151':({basic:'#9ee',fast:'#f9e',armored:'#999',splitter:'#9f9',regen:'#7f7',camo:'#556'})[e.type]||'#fff';ctx.beginPath();ctx.arc(e.x,e.y,e.boss?17:9,0,7);ctx.fill();ctx.fillStyle='#000';ctx.fillRect(e.x-10,e.y-15,20,3);ctx.fillStyle='#f44';ctx.fillRect(e.x-10,e.y-15,20*(e.hp/e.maxHp),3);}
    ctx.fillStyle='#fff';for(const p of state.projectiles){ctx.beginPath();ctx.arc(p.x,p.y,3,0,7);ctx.fill();}
    for(const p of state.particles){ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,2,2);p.x+=p.vx;p.y+=p.vy;}
    ctx.fillStyle='#ffd';for(const n of state.nums){ctx.fillText(n.txt,n.x,n.y);} ctx.restore();
  }
  function updateUI(){ui.lives.textContent=Math.max(0,Math.floor(state.lives));ui.cash.textContent=Math.floor(state.cash);ui.wave.textContent=`${state.wave}/20`;ui.relicCount.textContent=state.relics.length;ui.selectedInfo.textContent=`${state.selected}: ${towerDefs[state.selected].tip} | Cost ${towerDefs[state.selected].cost}`;}
  function renderTowerButtons(){ui.towerBar.innerHTML='';Object.keys(towerDefs).forEach(k=>{const b=document.createElement('button');b.textContent=`${k} (${towerDefs[k].cost})`;b.title=towerDefs[k].upgrades.join(', ');b.onclick=()=>{state.selected=k;updateUI();};ui.towerBar.appendChild(b);});}
  let last=performance.now();function loop(ts){const dt=Math.min(.05,(ts-last)/1000);last=ts;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
  function pointerPos(ev){const r=canvas.getBoundingClientRect();const t=ev.touches?ev.touches[0]:ev;return{x:(t.clientX-r.left)/r.width*900,y:(t.clientY-r.top)/r.height*520};}
  canvas.addEventListener('pointerdown',e=>{state.dragPos=pointerPos(e);});canvas.addEventListener('pointermove',e=>{if(state.dragPos)state.dragPos=pointerPos(e);});canvas.addEventListener('pointerup',e=>{const p=pointerPos(e);placeTower(p.x,p.y,state.selected);state.dragPos=null;});
  ui.pauseBtn.onclick=()=>{state.paused=!state.paused;ui.pauseBtn.textContent=state.paused?'Resume':'Pause';}; ui.speedBtn.onclick=()=>{state.speed=state.speed===1?2:1;ui.speedBtn.textContent=state.speed===1?'x2':'x1';}; ui.nextWaveBtn.onclick=spawnWave; ui.restartBtn.onclick=()=>init(4242);
  init();
})();
