(function(){
const $ = s=>document.querySelector(s), $$ = s=>Array.from(document.querySelectorAll(s));
const KEY='sleep-diary-v11'; function loadAll(){ try{ return JSON.parse(localStorage.getItem(KEY))||{entries:{},settings:{schemaVersion:1, weights:{onset:{}}, customAwake:[], customOnset:[], customRituals:[], adaptive:true}} } catch(e){ return {entries:{},settings:{schemaVersion:1, weights:{onset:{}}, customAwake:[], customOnset:[], customRituals:[], adaptive:true}} } }
function saveAll(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
function storageOK(){ try{ const k='__t'+Date.now(); localStorage.setItem(k,'1'); localStorage.removeItem(k); return true;}catch(e){return false;} }
function dateISO(d){ if(typeof d==='string') return d; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }

function setActiveTab(tab){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); (document.getElementById(tab)||document.getElementById('home')).classList.add('active'); document.querySelectorAll('#bottomTabs a').forEach(a=>a.classList.toggle('active', a.dataset.tab===tab)); if(tab==='week') renderWeek(); if(tab==='month') renderMonth(); if(tab==='home') renderHome(); }
function navigate(tab){ location.hash = '#/'+tab; } function onRoute(){ const m=location.hash.match(/^#\/(\w+)/); setActiveTab(m?m[1]:'home'); }
window.addEventListener('hashchange', onRoute);
document.addEventListener('click', e=>{ const a=e.target.closest('#bottomTabs a'); if(!a) return; e.preventDefault(); navigate(a.dataset.tab); });

function makeGauge(el, {title, labels}){
  el.innerHTML = `
    <div class="gauge" aria-label="${title}">
      <div class="live" aria-live="polite">Wert: <b id="val">3</b>/5 – <span id="txt">${labels[2]}</span></div>
      <svg viewBox="0 0 420 210">
        <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444"/><stop offset="35%" stop-color="#f59e0b"/>
          <stop offset="65%" stop-color="#22c55e"/><stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient></defs>
        <path d="M30,180 A180,180 0 0 1 390,180" fill="none" stroke="url(#grad)" stroke-width="28"/>
        <g id="ticks"></g>
        <g id="needle" class="needle" transform="translate(210,180) rotate(90)">
          <polygon points="-6,0 6,0 0,-130" fill="#0f172a"></polygon>
          <circle cx="0" cy="0" r="7" fill="#0f172a"></circle>
          <circle class="handle" cx="0" cy="0" r="16" fill="transparent"></circle>
        </g>
      </svg>
    </div>
    <div class="scale" aria-hidden="true">
      <span>${labels[0]}</span><span>${labels[1]}</span><span>${labels[2]}</span><span>${labels[3]}</span><span>${labels[4]}</span>
    </div>`;
  const steps=5, angMin=-180, angMax=0;
  const needle=el.querySelector('#needle');
  const gaugeBox=el.querySelector('.gauge');
  const outV=el.querySelector('#val'); const outT=el.querySelector('#txt');
  const tg = el.querySelector('#ticks');
  for(let i=0;i<=20;i++){
    const t=i/20; const ang=(angMin+(angMax-angMin)*t)*Math.PI/180;
    const cx=210+Math.cos(ang)*150, cy=180+Math.sin(ang)*150;
    const cx2=210+Math.cos(ang)*166, cy2=180+Math.sin(ang)*166;
    const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
    ln.setAttribute('x1',cx); ln.setAttribute('y1',cy); ln.setAttribute('x2',cx2); ln.setAttribute('y2',cy2);
    ln.setAttribute('stroke','#fff'); ln.setAttribute('stroke-width', i%5===0?3:2);
    tg.appendChild(ln);
  }
  function setIndex(idx){
    idx=Math.max(0,Math.min(steps-1,idx));
    const t=idx/(steps-1);
    const ang=angMin+(angMax-angMin)*t;
    needle.style.transform=`translate(210px,180px) rotate(${ang+90}deg)`;
    el.value = idx+1; outV.textContent = String(idx+1); outT.textContent = labels[idx];
  }
  function idxFromPoint(clientX, clientY){
    const rect=gaugeBox.getBoundingClientRect();
    const x=clientX-(rect.left+rect.width/2);
    const y=clientY-(rect.top+rect.height*0.857);
    let a=Math.atan2(y,x)*180/Math.PI;
    a=Math.max(angMin,Math.min(angMax,a));
    const t=(a-angMin)/(angMax-angMin);
    return Math.round(t*(steps-1));
  }
  let dragging=false;
  function start(e){dragging=true; e.preventDefault(); update(e);}
  function move(e){if(!dragging) return; update(e);}
  function end(){dragging=false;}
  function update(e){const p=e.touches?.[0] ?? e; const idx=idxFromPoint(p.clientX,p.clientY); setIndex(idx); el.dispatchEvent(new CustomEvent('change',{detail:{value:idx+1}}));}
  gaugeBox.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  setIndex(2);
  return {get value(){return el.value||3}, set value(v){setIndex((+v||3)-1)}};
}

function sleepDurationMin(e){
  if(e?.noSleep) return 0;
  if(!e?.times?.asleep || !e?.times?.wake) return null;
  const [aH,aM]=e.times.asleep.split(':').map(Number);
  const [wH,wM]=e.times.wake.split(':').map(Number);
  let a=aH*60+aM, w=wH*60+wM; if(w<a) w+=24*60;
  return Math.max(0, w-a);
}

let gaugeQ,gaugeF,gaugeOn;
function onReady(){
  if(!storageOK()){ alert('Hinweis: localStorage nicht verfügbar – bitte im normalen Browser öffnen.'); }
  const d0=loadAll();
  const defaults=['rumination','screenLate','caffeine','heavyMeal','noise','pain','stress'];
  d0.settings.weights ||= {onset:{}};
  defaults.forEach(k=>{ if(typeof d0.settings.weights.onset[k] !== 'number') d0.settings.weights.onset[k]=1; });
  d0.settings.adaptive = d0.settings.adaptive!==false;
  saveAll(d0);

  gaugeQ=makeGauge(document.querySelector('#gaugeQuality'),{title:'Schlafqualität',labels:['Sehr schlecht','Schlecht','Mittelmäßig','Gut','Sehr gut']});
  gaugeF=makeGauge(document.querySelector('#gaugeFeeling'),{title:'Morgendliches Befinden',labels:['Völlig erschöpft','Schläfrig','Funktional','Gut erholt','Energiegeladen']});
  gaugeOn=makeGauge(document.querySelector('#gaugeOnset'),{title:'Einschlafen – Schwierigkeit',labels:['Sehr schwer','Schwierig','Mittel','Leicht','Sehr leicht']});

  ['reasons','onsetChips','rituals'].forEach(id=>{
    const w=document.getElementById(id);
    w.addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b || b.classList.contains('step')) return;
      b.classList.toggle('active'); if(id==='onsetChips'){ syncOnsetDots(); persistOnsetIntensityFromActive(); updateOnsetAuto(); } });
  });

  document.getElementById('awakeAddBtn').addEventListener('click', ()=> addCustom('reasons','awakeAddInput','customAwake'));
  document.getElementById('onsetAddBtn').addEventListener('click', ()=> addCustom('onsetChips','onsetAddInput','customOnset', true));
  document.getElementById('ritualAddBtn').addEventListener('click', ()=> addCustom('rituals','ritualAddInput','customRituals'));

  document.getElementById('dateInput').value=dateISO(new Date());
  loadEntryFor(document.getElementById('dateInput').value);
  document.getElementById('dateInput').addEventListener('change', e=>loadEntryFor(e.target.value));

  document.getElementById('saveEntry').addEventListener('click', saveEntry);
  document.getElementById('newEntry').addEventListener('click', ()=>fillUI(null));
  document.getElementById('deleteEntry').addEventListener('click', deleteEntry);

  const d=loadAll();
  addChips('reasons', d.settings.customAwake, true);
  addChips('onsetChips', d.settings.customOnset, true);
  addChips('rituals', d.settings.customRituals, true);

  decorateOnsetChips(); syncOnsetDots(); updateOnsetAuto();

  renderWeightsOnset();
  document.getElementById('resetWeights').addEventListener('click', ()=>{ const d=loadAll(); Object.keys(d.settings.weights.onset).forEach(k=>d.settings.weights.onset[k]=1); saveAll(d); renderWeightsOnset(); });
  document.getElementById('adaptiveWeights').checked = loadAll().settings.adaptive!==false;
  document.getElementById('adaptiveWeights').addEventListener('change', e=>{ const d=loadAll(); d.settings.adaptive = e.target.checked; saveAll(d); });

  document.getElementById('toggleTableBtn').addEventListener('click', ()=> document.getElementById('weekTableWrap').classList.toggle('hidden'));

  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('importJson').addEventListener('change', importJson);
  document.getElementById('clearAll').addEventListener('click', clearAll);
}

function addCustom(containerId,inputId,key, isOnset=false){
  const val=(document.getElementById(inputId).value||'').trim(); if(!val) return;
  const d=loadAll(); if(!d.settings[key].includes(val)){ d.settings[key].push(val); saveAll(d); addChips(containerId,[val],true); if(isOnset){ d.settings.weights.onset[val]=1; saveAll(d); renderWeightsOnset(); } }
  document.getElementById(inputId).value='';
}
function addChips(containerId, items, custom=false){
  const w=document.getElementById(containerId);
  const exists=new Set(Array.from(w.querySelectorAll('button')).map(b=>b.dataset.val));
  (items||[]).forEach(v=>{ if(exists.has(v)) return; const btn=document.createElement('button'); btn.dataset.val=v; btn.dataset.custom=custom?'1':'0'; btn.innerHTML=`✨ ${v}`; btn.title=v; w.appendChild(btn); });
}

function getOnsetIntensityMap(date){ const d=loadAll(); const e=d.entries[date||document.getElementById('dateInput').value]; return (e?.sleepOnset?.intensity)||{}; }
function setOnsetIntensityMap(m, date){ const dt=date||document.getElementById('dateInput').value; const d=loadAll(); const e=d.entries[dt]||{date:dt}; e.sleepOnset = { ...(e.sleepOnset||{}), intensity:m, reasons:Object.keys(m).filter(k=>m[k]>0) }; d.entries[dt]=e; saveAll(d); }
function decorateOnsetChips(){
  document.querySelectorAll('#onsetChips button').forEach(b=>{ if(b.querySelector('.meter')) return; const meter=document.createElement('span'); meter.className='meter'; meter.innerHTML='<i class="dot"></i><i class="dot"></i><i class="dot"></i>'; const step=document.createElement('button'); step.type='button'; step.className='step'; step.textContent='±'; b.appendChild(meter); b.appendChild(step); });
  document.getElementById('onsetChips').addEventListener('click', e=>{
    const step=e.target.closest('.step'); if(!step) return;
    const btn=e.target.closest('button'); const k=btn.dataset.val;
    const m=getOnsetIntensityMap(); const cur=m[k] ?? (btn.classList.contains('active')?1:0);
    const next=(cur+1)%4; if(next===0) btn.classList.remove('active'); else btn.classList.add('active');
    m[k]=next; setOnsetIntensityMap(m); syncOnsetDots(); updateOnsetAuto();
  });
  document.getElementById('onsetChips').addEventListener('contextmenu', e=>{
    const btn=e.target.closest('button'); if(!btn) return; e.preventDefault();
    const k=btn.dataset.val; const m=getOnsetIntensityMap(); const cur=m[k] ?? (btn.classList.contains('active')?1:0);
    const next=(cur+3)%4; if(next===0) btn.classList.remove('active'); else btn.classList.add('active');
    m[k]=next; setOnsetIntensityMap(m); syncOnsetDots(); updateOnsetAuto();
  });
}
function syncOnsetDots(){
  const intensMap=getOnsetIntensityMap();
  document.querySelectorAll('#onsetChips button').forEach(b=>{
    const k=b.dataset.val;
    const val= intensMap[k] ?? (b.classList.contains('active')?1:0);
    const dots=b.querySelectorAll('.dot');
    dots.forEach((d,i)=> d.classList.toggle('on', i<val));
    b.classList.toggle('active', val>0);
  });
}
function persistOnsetIntensityFromActive(){
  const m=getOnsetIntensityMap();
  document.querySelectorAll('#onsetChips button').forEach(b=>{ const k=b.dataset.val; if(b.classList.contains('active') && !m[k]) m[k]=1; if(!b.classList.contains('active')) m[k]=0; });
  setOnsetIntensityMap(m);
}

function onsetWeightedScore(entry, settings){
  const intens = entry?.sleepOnset?.intensity || {};
  const weights = settings?.weights?.onset || {};
  const keys = new Set([...Object.keys(intens), ...Object.keys(weights)]);
  let sum=0, max=0; keys.forEach(k=>{ const i=intens[k]||0; const w=weights[k]||1; sum += w*i; max += 3*3; });
  if(max===0) return null; const t = sum / max; return Math.round(1 + t*4);
}

function collectChips(id){ return Array.from(document.querySelectorAll('#'+id+' button.active')).map(b=>b.dataset.val); }
function setChips(id, arr){ document.querySelectorAll('#'+id+' button').forEach(b=> b.classList.toggle('active', arr?.includes(b.dataset.val))); }
function getRadio(name){ const r=document.querySelector(`input[name="${name}"]:checked`); return r? r.value : null; }
function setRadio(name, val){ document.querySelectorAll(`input[name="${name}"]`).forEach(x=> x.checked=(x.value===val)); }

function getEntryFromUI(){
  const date=document.getElementById('dateInput').value;
  return {
    date,
    times:{ bed:document.getElementById('bedTime').value||null, asleep:document.getElementById('asleepTime').value||null, wake:document.getElementById('wakeTime').value||null, up:document.getElementById('upTime').value||null },
    noSleep: document.getElementById('noSleep').checked,
    quality:Number(gaugeQ.value)||3,
    morningFeeling:Number(gaugeF.value)||3,
    sleepOnset:{
      difficulty:Number(gaugeOn.value)||3,
      reasons:collectChips('onsetChips'),
      intensity:getOnsetIntensityMap(date)
    },
    nightAwakenings:{ occurred:getRadio('awake')==='yes', countApprox:Number(document.getElementById('awakeCount').value||0), reasons:collectChips('reasons') },
    nap:{ occurred:getRadio('nap')==='yes', when:document.getElementById('napWhen').value||null, durationMin:Number(document.getElementById('napDuration').value||0) },
    drinkAfter20:{ occurred:getRadio('drink20')==='yes', amountMl:Number(document.getElementById('drinkMl').value||0) },
    rituals:collectChips('rituals'),
    notes:document.getElementById('nightNotes').value||'',
    extras:{ caffeineEvening:document.getElementById('caffeineEvening')?.checked||false, screenTimeLate:document.getElementById('screenTimeLate')?.checked||false },
    updatedAt:Date.now()
  };
}
function fillUI(e){
  document.getElementById('bedTime').value=e?.times?.bed||''; document.getElementById('asleepTime').value=e?.times?.asleep||''; document.getElementById('wakeTime').value=e?.times?.wake||''; document.getElementById('upTime').value=e?.times?.up||'';
  document.getElementById('noSleep').checked=!!(e?.noSleep);
  document.getElementById('asleepTime').disabled = document.getElementById('wakeTime').disabled = document.getElementById('noSleep').checked;
  document.getElementById('noSleep').addEventListener('change', ()=>{ document.getElementById('asleepTime').disabled = document.getElementById('wakeTime').disabled = document.getElementById('noSleep').checked; });
  gaugeQ.value=e?.quality??3; gaugeF.value=e?.morningFeeling??3; gaugeOn.value=e?.sleepOnset?.difficulty??3;
  setChips('onsetChips', e?.sleepOnset?.reasons||[]);
  setRadio('awake', e?.nightAwakenings?.occurred?'yes':'no'); document.getElementById('awakeCount').value=e?.nightAwakenings?.countApprox??0; setChips('reasons', e?.nightAwakenings?.reasons||[]);
  setRadio('nap', e?.nap?.occurred?'yes':'no'); document.getElementById('napWhen').value=e?.nap?.when||''; document.getElementById('napDuration').value=e?.nap?.durationMin??0;
  setRadio('drink20', e?.drinkAfter20?.occurred?'yes':'no'); document.getElementById('drinkMl').value=e?.drinkAfter20?.amountMl??0;
  setChips('rituals', e?.rituals||[]);
  document.getElementById('nightNotes').value=e?.notes||'';
  syncOnsetDots(); updateOnsetAuto();
}

function saveEntry(){
  if(!storageOK()){ alert('Speichern nicht möglich (localStorage gesperrt).'); return; }
  let e=getEntryFromUI();
  const mins = (function(e){ if(e?.noSleep) return 0; if(!e?.times?.asleep || !e?.times?.wake) return 0; const [aH,aM]=e.times.asleep.split(':').map(Number); const [wH,wM]=e.times.wake.split(':').map(Number); let a=aH*60+aM, w=wH*60+wM; if(w<a) w+=24*60; return Math.max(0,w-a); })(e);
  if((!e.times.asleep || !e.times.wake || mins===0) && !e.noSleep){
    const ok = confirm('Es ergibt sich 0 Stunden. Als „Nicht geschlafen (durchgewacht)“ speichern?');
    if(!ok){ alert('Speichern abgebrochen. Bitte Zeiten prüfen oder „Nicht geschlafen“ aktivieren.'); return; }
    e.noSleep=true;
  }
  const d=loadAll(); d.entries[e.date]=e; saveAll(d);
  adaptWeightsAfterSave(e);
  const t=document.getElementById('toast'); t.textContent='✔ Gespeichert'; setTimeout(()=>t.textContent='',1200);
  renderHome();
}
function deleteEntry(){
  if(!storageOK()){ alert('Löschen nicht möglich (localStorage gesperrt).'); return; }
  const date=document.getElementById('dateInput').value; if(!confirm('Eintrag für '+date+' löschen?')) return;
  const d=loadAll(); delete d.entries[date]; saveAll(d); fillUI(null);
  const t=document.getElementById('toast'); t.textContent='✔ Gelöscht'; setTimeout(()=>t.textContent='', 1200);
}
function loadEntryFor(date){ const d=loadAll(); const e=d.entries[date]; fillUI(e||null); }

function adaptWeightsAfterSave(entry){
  const d=loadAll(); if(d.settings.adaptive===false) return;
  const W=d.settings.weights.onset; const I=entry.sleepOnset?.intensity||{};
  const g = Number(entry.sleepOnset?.difficulty||3);
  Object.keys(I).forEach(k=>{
    if(I[k]<=0) return;
    if(g>=4 && W[k]<3) W[k]+=0.1;
    if(g<=2 && W[k]>0) W[k]-=0.1;
    W[k]=Math.max(0, Math.min(3, Math.round(W[k]*10)/10));
  });
  saveAll(d);
}

function renderHome(){
  const d=loadAll();
  const last = Object.values(d.entries||{}).sort((a,b)=> (b?.updatedAt||0)-(a?.updatedAt||0))[0];
  const L=document.getElementById('homeLast'), Q=document.getElementById('homeQ'), H=document.getElementById('homeH');
  if(L) L.textContent = last ? (last.noSleep? `${last.date} · Nicht geschlafen` : last.date) : '–';
  const today = dateISO(new Date());
  const days = (function(date){ const x=new Date(date); const day=(x.getDay()+6)%7; const st=new Date(x); st.setDate(x.getDate()-day); const p=n=>String(n).padStart(2,'0'); return [...Array(7)].map((_,i)=>{const dt=new Date(st); dt.setDate(st.getDate()+i); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;});})(today);
  const rows = days.map(dt=>d.entries[dt]).filter(Boolean);
  const avg=a=>a.length? a.reduce((x,y)=>x+y,0)/a.length : null;
  const qAvg=avg(rows.map(e=>e.quality||0))||null; if(Q) Q.textContent=qAvg? qAvg.toFixed(1) : '–';
  function durH(e){ const m=(function(e){ if(e?.noSleep) return 0; if(!e?.times?.asleep || !e?.times?.wake) return null; const [aH,aM]=e.times.asleep.split(':').map(Number); const [wH,wM]=e.times.wake.split(':').map(Number); let a=aH*60+aM, w=wH*60+wM; if(w<a) w+=24*60; return Math.max(0, w-a); })(e); return m==null? null : m/60; }
  const hAvg=avg(rows.map(durH).filter(v=>v!=null))||null; if(H) H.textContent=hAvg? hAvg.toFixed(1):'–';
}

function avg(xs){ const n=xs.filter(v=>typeof v==='number'&&!isNaN(v)); return n.length? (n.reduce((a,b)=>a+b,0)/n.length) : null; }
function topCounts(arr, n=5){ const m=new Map(); arr.forEach(list => (list||[]).forEach(x => m.set(x,(m.get(x)||0)+1))); return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n); }
function badgeClass(v){ if(v==null) return 'ok'; if(v>=4) return 'good'; if(v>=3) return 'ok'; return 'bad'; }
function getWeekRange(date){ const d=new Date(date); const day=(d.getDay()+6)%7; const start=new Date(d); start.setDate(d.getDate()-day); return [...Array(7)].map((_,i)=>{const dt=new Date(start); dt.setDate(start.getDate()+i); const p=n=>String(n).padStart(2,'0'); return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}`;}); }
function sparkline(vals, min, max){ if(!vals.length) return '<svg class="spark"></svg>'; const w=160,h=36; const xs = vals.map((v,i)=> i*(w/(vals.length-1))); const ys = vals.map(v => h - ((v-min)/(max-min||1))*h ); let d='M'+xs.map((x,i)=> `${x},${ys[i]}`).join(' L '); return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="#0ea5e9" stroke-width="2"/><circle cx="${xs.at(-1)}" cy="${ys.at(-1)}" r="2" fill="#0ea5e9"/></svg>`; }

function renderWeek(){
  const date=document.getElementById('dateInput')?.value || dateISO(new Date());
  const data=loadAll(); const days=getWeekRange(date);
  const rows=days.map(d=>{ const e=data.entries[d]; const dur=(function(e){ if(e?.noSleep) return 0; if(!e?.times?.asleep || !e?.times?.wake) return null; const [aH,aM]=e.times.asleep.split(':').map(Number); const [wH,wM]=e.times.wake.split(':').map(Number); let a=aH*60+aM, w=wH*60+wM; if(w<a) w+=24*60; return Math.max(0, w-a); })(e);
    return { date:d, e, durationH: dur!=null ? dur/60 : null, quality: e?.quality ?? null, feeling: e?.morningFeeling ?? null, onset: e?.sleepOnset?.difficulty ?? null, awaken: typeof e?.nightAwakenings?.countApprox==='number' ? e.nightAwakenings.countApprox : null, napMin: e?.nap?.occurred ? (e.nap.durationMin||0) : 0, reasonsNight: e?.nightAwakenings?.reasons || [], reasonsOnset: e?.sleepOnset?.reasons || [], rituals: e?.rituals || [], drinkAfter20: e?.drinkAfter20?.occurred || false, noSleep: !!e?.noSleep }; });

  const durAvg=avg(rows.map(r=>r.durationH));
  const qAvg=avg(rows.map(r=>r.quality));
  const fAvg=avg(rows.map(r=>r.feeling));
  const onAvg=avg(rows.map(r=>r.onset));
  const awAvg=avg(rows.map(r=>r.awaken));
  const napTotal=rows.reduce((a,b)=>a+(b.napMin||0),0);
  const lateDrinks=rows.filter(r=>r.drinkAfter20).length;
  const noSleepCount=rows.filter(r=>r.noSleep).length;

  const qSpark = sparkline(rows.map(r=>r.quality||0).filter(Boolean),1,5);
  const dSpark = sparkline(rows.map(r=>r.durationH||0).filter(Boolean),0,10);

  document.getElementById('weekCards').innerHTML = `
    <div class="kpi">
      <div class="stat"><h4>Schlafdauer (Ø)</h4><div class="big">${durAvg!=null? durAvg.toFixed(1) : '-' } h</div>${dSpark}<div class="small" style="margin-top:4px">Ziel: 7–9 h</div></div>
      <div class="stat"><h4>Qualität · Befinden · Einschlafen</h4>
        <div class="pills">
          <span class="badge ${badgeClass(qAvg)}">Qualität ${qAvg!=null? qAvg.toFixed(1):'-'}/5</span>
          <span class="badge ${badgeClass(fAvg)}">Befinden ${fAvg!=null? fAvg.toFixed(1):'-'}/5</span>
          <span class="badge ${badgeClass(onAvg)}">Einschlafen ${onAvg!=null? onAvg.toFixed(1):'-'}/5</span>
        </div>
        ${qSpark}
      </div>
      <div class="stat"><h4>Nacht & Tagesfaktoren</h4>
        <div class="pills">
          <span class="badge ok">Aufwachen Ø ${awAvg!=null? awAvg.toFixed(1):'-'}×</span>
          <span class="badge ok">Tagschlaf ${napTotal} Min</span>
          <span class="badge ok">Spät getrunken: ${lateDrinks}×</span>
          <span class="badge bad">Nicht geschlafen: ${noSleepCount}×</span>
        </div>
      </div>
    </div>`;

  const W=data.settings?.weights?.onset||{};
  const impactMap=new Map();
  rows.forEach(r=>{
    const I=r.e?.sleepOnset?.intensity||{};
    Object.keys(I).forEach(k=>{
      const score=(W[k]||1)*(I[k]||0);
      impactMap.set(k,(impactMap.get(k)||0)+score);
    });
  });
  const impact = Array.from(impactMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
  function pretty(k){ const map = {toilet:'🚻 Toilettengang', rumination:'🧠 Grübeln', temp:'🌡️ Temperatur', discomfort:'🛏️ Unbequem', noiseLight:'🔆 Geräusch/Licht', screenLate:'📱 Screen spät', caffeine:'☕ Koffein', heavyMeal:'🍝 Schweres Essen', noise:'🔊 Geräusche', pain:'🤕 Schmerzen', stress:'⚡ Stress', read:'📖 Gelesen', music:'🎵 Musik', breathing:'🫁 Atemübung', warmShower:'🚿 Warme Dusche'}; return map[k] || ('✨ '+k); }
  function bar(w){ const max=3*3*rows.length || 1; const pct=Math.min(100, (w/max)*100); return `<div class="progress" style="width:160px"><b style="width:${pct}%"></b></div>`; }
  document.getElementById('weekLists').innerHTML = `
    <div class="cardlist">
      <div class="item"><div class="left">🛌 <b>Größter Einfluss (Einschlafen)</b></div><div class="count">Gewicht × Intensität</div></div>
      ${ impact.length? impact.map(([k,v])=>`<div class="item"><div class="left">${pretty(k)}</div><div>${bar(v)}</div></div>`).join('') : '<div class="small">Keine Daten</div>'}
      <div class="item" style="margin-top:8px"><div class="left">🌙 Häufigste Aufwach-Gründe</div><div class="count">${topCounts(rows.map(r=>r.reasonsNight)).map(([k,v])=>pretty(k)+' '+v+'×').join(' · ')||'–'}</div></div>
      <div class="item"><div class="left">✨ Meist genutzte Rituale</div><div class="count">${topCounts(rows.map(r=>r.rituals)).map(([k,v])=>pretty(k)+' '+v+'×').join(' · ')||'–'}</div></div>
    </div>`;

  const th=`<tr><th>Datum</th><th>Dauer (h)</th><th>Qualität</th><th>Befinden</th><th>Einschlafen</th><th>Aufwachen (≈)</th><th>Tagschlaf (Min)</th></tr>`;
  const tr=rows.map(r=>{ const dateCell = r.noSleep ? `${r.date} <span class="badge bad" style="margin-left:6px">keine Nacht</span>` : r.date; return `<tr><td>${dateCell}</td><td>${r.durationH!=null? r.durationH.toFixed(1): '-'}</td><td>${r.quality??'-'}</td><td>${r.feeling??'-'}</td><td>${r.onset??'-'}</td><td>${r.awaken??'-'}</td><td>${r.napMin||'-'}</td></tr>`; }).join('');
  document.getElementById('weekTableWrap').innerHTML = `<table class="table">${th}${tr}</table>`;
}

function renderMonth(){
  const date=document.getElementById('dateInput')?.value || dateISO(new Date());
  const d=new Date(date); const y=d.getFullYear(), m=d.getMonth();
  const first=new Date(y,m,1), next=new Date(y,m+1,1);
  const daysIn=Math.round((next-first)/(1000*60*60*24));
  const data=loadAll();
  let cells=''; for(let i=1;i<=daysIn;i++){ const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; const e=data.entries[iso]; const q=e?.quality||0; const color = q? ['#ffe5e5','#ffe9cc','#def7e0','#d1f4ff','#bfe9ff'][q-1] : '#f3f4f6'; cells += `<div class="cell" title="${iso} – Qual: ${q||'-'}" style="background:${color};padding:6px;text-align:center;border-radius:8px">${i}</div>`; }
  document.getElementById('monthHeatmap').innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${cells}</div>`;
  let n=0, sq=0, sf=0, sd=0; for(let i=1;i<=daysIn;i++){ const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`; const e=data.entries[iso]; if(!e) continue; n++; sq+=e.quality||0; sf+=e.morningFeeling||0; const mins=(function(e){ if(e?.noSleep) return 0; if(!e?.times?.asleep || !e?.times?.wake) return 0; const [aH,aM]=e.times.asleep.split(':').map(Number); const [wH,wM]=e.times.wake.split(':').map(Number); let a=aH*60+aM, w=wH*60+wM; if(w<a) w+=24*60; return Math.max(0,w-a); })(e); sd+= (mins||0)/60; }
  document.getElementById('monthTrends').innerHTML = `<div class="summary"><span>Ø Qualität: <b>${n? (sq/n).toFixed(1): '-'}</b></span><span>Ø Befinden: <b>${n? (sf/n).toFixed(1): '-'}</b></span><span>Ø Dauer: <b>${n? (sd/n).toFixed(1): '-'}</b> h</span></div>`;
}

function renderWeightsOnset(){
  const d=loadAll(); const w=d.settings?.weights?.onset||{};
  const pretty = {rumination:'🧠 Grübeln',screenLate:'📱 Screen spät',caffeine:'☕ Koffein',heavyMeal:'🍝 Schweres Essen',noise:'🔊 Geräusche',pain:'🤕 Schmerzen',stress:'⚡ Stress'};
  const keys = Object.keys(w).sort();
  const rows = keys.map(k=>`
    <tr>
      <td>${pretty[k]||('✨ '+k)}</td>
      <td style="width:220px">
        <input type="range" min="0" max="3" step="1" value="${w[k]}" data-k="${k}"/>
      </td>
      <td style="text-align:right"><b>${w[k]}</b></td>
    </tr>`).join('');
  document.getElementById('weightsOnsetList').innerHTML = `<table class="table"><tr><th>Grund</th><th>Gewicht (0–3)</th><th></th></tr>${rows}</table>`;
  document.getElementById('weightsOnsetList').oninput = (e)=>{
    const r=e.target; if(r.type!=='range') return;
    const d=loadAll(); d.settings.weights.onset[r.dataset.k]=Number(r.value); saveAll(d);
    r.closest('tr').querySelector('b').textContent=r.value;
  };
}

function updateOnsetAuto(){
  const d=loadAll(); const e=d.entries[document.getElementById('dateInput').value] || getEntryFromUI();
  const s=(function(entry, settings){ const intens = entry?.sleepOnset?.intensity || {}; const weights = settings?.weights?.onset || {}; const keys = new Set([...Object.keys(intens), ...Object.keys(weights)]); let sum=0, max=0; keys.forEach(k=>{ const i=intens[k]||0; const w=weights[k]||1; sum += w*i; max += 3*3; }); if(max===0) return null; const t = sum / max; return Math.round(1 + t*4); })(e, d.settings);
  const el=document.getElementById('onsetAutoFill');
  if(!el) return; if(s){ el.innerHTML = `Begründeter Score: <b>${s}/5</b> &nbsp; <button class="secondary" id="btnAutoOnset">Auto ausfüllen</button>`; document.getElementById('btnAutoOnset').onclick=()=>{ gaugeOn.value=s; el.innerHTML='Übernommen ✔'; }; } else { el.textContent=''; }
}

function exportJson(){ const data=loadAll(); const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='schlaftagebuch.json'; a.click(); URL.revokeObjectURL(url); }
function exportCsv(){
  const d=loadAll(); const rows = Object.values(d.entries||{}).sort((a,b)=> (a.date>b.date?1:-1));
  const head = ['date','bed','asleep','wake','up','noSleep','quality','morningFeeling','onsetDifficulty','awakeOccurred','awakeApprox','napOccurred','napWhen','napDuration','drinkAfter20','drinkMl','rituals','onsetReasons','onsetIntensity(json)','notes'];
  const lines = [head.join(',')];
  rows.forEach(e=>{
    const c=[ e.date||'', e.times?.bed||'', e.times?.asleep||'', e.times?.wake||'', e.times?.up||'', e.noSleep?1:0, e.quality||'', e.morningFeeling||'', e.sleepOnset?.difficulty||'', e.nightAwakenings?.occurred?1:0, e.nightAwakenings?.countApprox??'', e.nap?.occurred?1:0, e.nap?.when||'', e.nap?.durationMin??'', e.drinkAfter20?.occurred?1:0, e.drinkAfter20?.amountMl??'', (e.rituals||[]).join('|'), (e.sleepOnset?.reasons||[]).join('|'), JSON.stringify(e.sleepOnset?.intensity||{}).replace(/"/g,"'"), (e.notes||'').replace(/\n/g,' ').replace(/,/g,';') ];
    lines.push(c.map(x=>String(x)).join(','));
  });
  const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='schlaftagebuch.csv'; a.click(); URL.revokeObjectURL(url);
}
function importJson(e){ const f=e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ try{ const d=JSON.parse(fr.result); saveAll(d); alert('Import erfolgreich.'); loadEntryFor(document.getElementById('dateInput').value);}catch(err){ alert('Fehler: '+err.message);} }; fr.readAsText(f); }
function clearAll(){ if(!confirm('Alle Daten lokal löschen?')) return; localStorage.removeItem(KEY); alert('Gelöscht.'); }

document.addEventListener('DOMContentLoaded', ()=>{ try{ onReady(); onRoute(); }catch(err){ alert('Init-Fehler: '+err.message); console.error(err); } });
})();