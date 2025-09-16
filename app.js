// Sleep Diary App (vanilla JS) – offline-first (localStorage).
// Minimal PWA; simple gauge; week/month summaries.

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------- Tabs
document.addEventListener('click', (e) => {
  const btn = e.target.closest('nav#tabs button');
  if(!btn) return;
  $$('#tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  $$('.tab').forEach(t => t.classList.remove('active'));
  $('#' + tab).classList.add('active');
  if(tab === 'week') renderWeek();
  if(tab === 'month') renderMonth();
});

// ---------- Gauge component
function makeGauge(el, {title, labels}){
  el.innerHTML = `
    <div class="gauge" aria-label="${title}">
      <svg viewBox="0 0 420 210">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="#ef4444"/>
            <stop offset="35%"  stop-color="#f59e0b"/>
            <stop offset="65%"  stop-color="#22c55e"/>
            <stop offset="100%" stop-color="#0ea5e9"/>
          </linearGradient>
        </defs>
        <path d="M30,180 A180,180 0 0 1 390,180" fill="none" stroke="url(#grad)" stroke-width="28"/>
        <g id="ticks"></g>
        <g id="needle" class="needle" transform="translate(210,180) rotate(50)">
          <polygon points="-6,0 6,0 0,-130" fill="#0f172a"></polygon>
          <circle cx="0" cy="0" r="7" fill="#0f172a"></circle>
          <circle class="handle" cx="0" cy="0" r="16" fill="transparent"></circle>
        </g>
      </svg>
    </div>
    <div class="labels"><span>${labels[0]}</span><span>${labels[1]}</span><span>${labels[2]}</span><span>${labels[3]}</span><span>${labels[4]}</span></div>
    <div class="summary" style="margin-top:6px">
      <span class="badge">Wert: <b id="val">3</b>/5</span>
      <span class="badge" id="lab">${labels[2]}</span>
    </div>
  `;
  const steps = 5, angMin = -180, angMax = 0;
  const needle = el.querySelector('#needle');
  const gaugeBox = el.querySelector('.gauge');
  const outVal = el.querySelector('#val');
  const outLab = el.querySelector('#lab');

  // ticks
  const tg = el.querySelector('#ticks');
  for (let i=0;i<=20;i++){
    const t = i/20;
    const ang = (angMin + (angMax-angMin)*t) * Math.PI/180;
    const cx = 210 + Math.cos(ang)*150;
    const cy = 180 + Math.sin(ang)*150;
    const cx2 = 210 + Math.cos(ang)*166;
    const cy2 = 180 + Math.sin(ang)*166;
    const ln = document.createElementNS('http://www.w3.org/2000/svg','line');
    ln.setAttribute('x1', cx); ln.setAttribute('y1', cy);
    ln.setAttribute('x2', cx2); ln.setAttribute('y2', cy2);
    ln.setAttribute('stroke', '#fff'); ln.setAttribute('stroke-width', i%5===0?3:2);
    tg.appendChild(ln);
  }

  function setIndex(idx){
    idx = Math.max(0, Math.min(steps-1, idx));
    const t = idx/(steps-1);
    const ang = angMin + (angMax-angMin)*t;
    needle.style.transform = `translate(210px,180px) rotate(${ang+90}deg)`;
    outVal.textContent = (idx+1).toString();
    outLab.textContent = labels[idx];
  }

  function idxFromPoint(clientX, clientY){
    const rect = gaugeBox.getBoundingClientRect();
    const x = clientX - (rect.left + rect.width/2);
    const y = clientY - (rect.top + rect.height*0.857);
    let a = Math.atan2(y, x) * 180/Math.PI;
    a = Math.max(angMin, Math.min(angMax, a));
    const t = (a - angMin) / (angMax - angMin);
    return Math.round(t*(steps-1));
  }

  let dragging = false;
  function start(e){ dragging = true; e.preventDefault(); update(e); }
  function move(e){ if(!dragging) return; update(e); }
  function end(){ dragging = false; }
  function update(e){
    const p = e.touches?.[0] ?? e;
    const idx = idxFromPoint(p.clientX, p.clientY);
    setIndex(idx);
    el.dispatchEvent(new CustomEvent('change', {detail:{value: idx+1}}));
  }

  gaugeBox.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  gaugeBox.addEventListener('touchstart', start, {passive:false});
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('touchend', end);

  setIndex(2); // init
  return {
    get value(){ return Number(outVal.textContent); },
    set value(v){ setIndex((+v||3)-1); }
  };
}

// ---------- Data
const KEY = 'sleep-diary-v1';

function loadAll(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || { entries: {} }; }
  catch(e){ return { entries: {} }; }
}
function saveAll(data){
  localStorage.setItem(KEY, JSON.stringify(data));
}

function dateISO(d){
  if(typeof d === 'string') return d;
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ---------- UI wiring
let gaugeQ, gaugeF;

function onReady(){
  // Tabs default
  $('#entry').classList.add('active');

  // Gauges
  gaugeQ = makeGauge($('#gaugeQuality'), {title:'Schlafqualität', labels:['Sehr schlecht','Schlecht','Mittelmäßig','Gut','Sehr gut']});
  gaugeF = makeGauge($('#gaugeFeeling'), {title:'Morgendliches Befinden', labels:['Völlig erschöpft','Schläfrig','Funktional','Gut erholt','Energiegeladen']});

  // Chips toggles
  $('#reasons').addEventListener('click', (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    b.classList.toggle('active');
  });
  $('#rituals').addEventListener('click', (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    b.classList.toggle('active');
  });

  // Save / New
  $('#saveEntry').addEventListener('click', saveEntry);
  $('#newEntry').addEventListener('click', clearEntry);
  $('#deleteEntry').addEventListener('click', deleteEntry);

  // Settings
  $('#exportJson').addEventListener('click', exportJson);
  $('#importJson').addEventListener('change', importJson);
  $('#clearAll').addEventListener('click', clearAll);

  $('#enableNotifs').addEventListener('click', enableNotifications);

  // Default date today
  $('#dateInput').value = dateISO(new Date());

  // load existing for today if any
  loadEntryFor($('#dateInput').value);

  // change date -> load
  $('#dateInput').addEventListener('change', e => loadEntryFor(e.target.value));
}

document.addEventListener('DOMContentLoaded', onReady);

// ---------- Entry helpers
function collectChips(id){
  return $$('#'+id+' button.active').map(b => b.dataset.val);
}
function setChips(id, arr){
  $$('#'+id+' button').forEach(b => b.classList.toggle('active', arr?.includes(b.dataset.val)));
}
function getRadio(name){
  const r = document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : null;
}
function setRadio(name, value){
  const r = document.querySelectorAll(`input[name="${name}"]`);
  r.forEach(x => x.checked = (x.value === value));
}

function getEntryFromUI(){
  const date = $('#dateInput').value;
  return {
    date,
    times: {
      bed: $('#bedTime').value || null,
      asleep: $('#asleepTime').value || null,
      wake: $('#wakeTime').value || null,
      up: $('#upTime').value || null
    },
    quality: gaugeQ.value,
    morningFeeling: gaugeF.value,
    nightAwakenings: {
      occurred: getRadio('awake') === 'yes',
      countApprox: Number($('#awakeCount').value || 0),
      reasons: collectChips('reasons')
    },
    nap: {
      occurred: getRadio('nap') === 'yes',
      when: $('#napWhen').value || null,
      durationMin: Number($('#napDuration').value || 0)
    },
    drinkAfter20: {
      occurred: getRadio('drink20') === 'yes',
      amountMl: Number($('#drinkMl').value || 0)
    },
    rituals: collectChips('rituals'),
    notes: $('#nightNotes').value || '',
    extras: {
      caffeineEvening: $('#caffeineEvening').checked,
      screenTimeLate: $('#screenTimeLate').checked
    },
    updatedAt: Date.now()
  };
}

function fillUIFromEntry(e){
  $('#bedTime').value = e?.times?.bed || '';
  $('#asleepTime').value = e?.times?.asleep || '';
  $('#wakeTime').value = e?.times?.wake || '';
  $('#upTime').value = e?.times?.up || '';
  gaugeQ.value = e?.quality ?? 3;
  gaugeF.value = e?.morningFeeling ?? 3;
  setRadio('awake', e?.nightAwakenings?.occurred ? 'yes' : 'no');
  $('#awakeCount').value = e?.nightAwakenings?.countApprox ?? 0;
  setChips('reasons', e?.nightAwakenings?.reasons || []);
  setRadio('nap', e?.nap?.occurred ? 'yes' : 'no');
  $('#napWhen').value = e?.nap?.when || '';
  $('#napDuration').value = e?.nap?.durationMin ?? 0;
  setRadio('drink20', e?.drinkAfter20?.occurred ? 'yes' : 'no');
  $('#drinkMl').value = e?.drinkAfter20?.amountMl ?? 0;
  setChips('rituals', e?.rituals || []);
  $('#nightNotes').value = e?.notes || '';
  $('#caffeineEvening').checked = !!e?.extras?.caffeineEvening;
  $('#screenTimeLate').checked = !!e?.extras?.screenTimeLate;
}

function saveEntry(){
  const data = loadAll();
  const e = getEntryFromUI();
  data.entries[e.date] = e;
  saveAll(data);
  alert('Eintrag gespeichert.');
}

function clearEntry(){
  fillUIFromEntry(null);
}

function deleteEntry(){
  const date = $('#dateInput').value;
  if(!confirm('Eintrag für ' + date + ' löschen?')) return;
  const data = loadAll();
  delete data.entries[date];
  saveAll(data);
  clearEntry();
  alert('Gelöscht.');
}

function loadEntryFor(date){
  const data = loadAll();
  const e = data.entries[date];
  fillUIFromEntry(e || null);
}

// ---------- Week & Month rendering
function getWeekRange(date){
  const d = new Date(date);
  const day = (d.getDay()+6)%7; // Mon=0
  const start = new Date(d); start.setDate(d.getDate()-day);
  const days = [...Array(7)].map((_,i)=>{
    const dt = new Date(start); dt.setDate(start.getDate()+i);
    return dateISO(dt);
  });
  return days;
}
function sleepDurationMin(e){
  if(!e?.times?.asleep || !e?.times?.wake) return null;
  const [aH,aM] = e.times.asleep.split(':').map(Number);
  const [wH,wM] = e.times.wake.split(':').map(Number);
  let a = aH*60+aM, w = wH*60+wM;
  if(w < a) w += 24*60;
  return w - a;
}

function renderWeek(){
  const date = $('#dateInput').value || dateISO(new Date());
  const data = loadAll();
  const days = getWeekRange(date);
  const rows = days.map(d => {
    const e = data.entries[d];
    const dur = sleepDurationMin(e);
    return {
      date: d,
      durationH: dur!=null ? (dur/60).toFixed(1) : '',
      quality: e?.quality ?? '',
      feeling: e?.morningFeeling ?? '',
      awaken: e?.nightAwakenings?.countApprox ?? '',
      nap: e?.nap?.occurred ? (e.nap.durationMin||0) : 0
    };
  });

  // Summary
  const avg = (arr)=>{
    const nums = arr.filter(x=>typeof x==='number' && !isNaN(x));
    if(nums.length===0) return null;
    return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1);
  };
  const durAvg = avg(rows.map(r=> r.durationH? Number(r.durationH): NaN));
  const qAvg = avg(rows.map(r=> r.quality? Number(r.quality): NaN));
  const fAvg = avg(rows.map(r=> r.feeling? Number(r.feeling): NaN));

  $('#weekSummary').innerHTML = `
    <span class="badge">Ø Dauer: <b>${durAvg ?? '-'}</b> h</span>
    <span class="badge">Ø Qualität: <b>${qAvg ?? '-'}</b>/5</span>
    <span class="badge">Ø Befinden: <b>${fAvg ?? '-'}</b>/5</span>
  `;

  // Table
  const th = `<tr><th>Datum</th><th>Dauer (h)</th><th>Qualität</th><th>Befinden</th><th>Aufwachen (≈)</th><th>Tagschlaf (Min)</th></tr>`;
  const tr = rows.map(r=>`<tr>
      <td>${r.date}</td>
      <td>${r.durationH || '-'}</td>
      <td>${r.quality || '-'}</td>
      <td>${r.feeling || '-'}</td>
      <td>${r.awaken || '-'}</td>
      <td>${r.nap || '-'}</td>
    </tr>`).join('');
  $('#weekTableWrap').innerHTML = `<table class="table">${th}${tr}</table>`;
}

function renderMonth(){
  const date = $('#dateInput').value || dateISO(new Date());
  const d = new Date(date);
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const next = new Date(y, m+1, 1);
  const daysInMonth = Math.round((next - first)/(1000*60*60*24));
  const data = loadAll();

  // Heatmap (simple grid)
  let cells = '';
  for(let i=1;i<=daysInMonth;i++){
    const iso = dateISO(new Date(y,m,i));
    const e = data.entries[iso];
    const q = e?.quality ?? 0;
    const color = q ? ['#ffe5e5','#ffe9cc','#def7e0','#d1f4ff','#bfe9ff'][q-1] : '#f3f4f6';
    cells += `<div class="cell" title="${iso} – Qual: ${q||'-'}" style="background:${color}">${i}</div>`;
  }
  $('#monthHeatmap').innerHTML = `
    <div class="hm" style="display:grid; grid-template-columns: repeat(7, 1fr); gap:6px">${cells}</div>
    <div class="muted" style="margin-top:8px">Farben zeigen die Qualitätswerte (1–5). Hellgrau = kein Eintrag.</div>
  `;

  // Trends (simple)
  let count = 0, sumQ=0, sumF=0, sumDur=0;
  for(let i=1;i<=daysInMonth;i++){
    const iso = dateISO(new Date(y,m,i));
    const e = data.entries[iso];
    if(!e) continue;
    count++;
    sumQ += e.quality||0;
    sumF += e.morningFeeling||0;
    const dur = sleepDurationMin(e); if(dur) sumDur += dur/60;
  }
  const qAvg = count? (sumQ/count).toFixed(1):'-';
  const fAvg = count? (sumF/count).toFixed(1):'-';
  const dAvg = count? (sumDur/count).toFixed(1):'-';
  $('#monthTrends').innerHTML = `
    <span class="badge">Ø Qualität: <b>${qAvg}</b></span>
    <span class="badge">Ø Befinden: <b>${fAvg}</b></span>
    <span class="badge">Ø Dauer: <b>${dAvg}</b> h</span>
  `;
}

// ---------- Export / Import
function exportJson(){
  const data = loadAll();
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schlaftagebuch.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(e){
  const file = e.target.files[0];
  if(!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try{
      const data = JSON.parse(fr.result);
      saveAll(data);
      alert('Import erfolgreich. Lade aktuelle Ansicht.');
      loadEntryFor($('#dateInput').value);
    } catch(err){
      alert('Fehler beim Import: ' + err.message);
    }
  };
  fr.readAsText(file);
}

function clearAll(){
  if(!confirm('Alle Daten lokal löschen?')) return;
  localStorage.removeItem(KEY);
  alert('Gelöscht.');
}

// ---------- Notifications (local, simple demo)
async function enableNotifications(){
  if(!('Notification' in window)) return alert('Browser unterstützt keine Benachrichtigungen.');
  let perm = Notification.permission;
  if(perm !== 'granted'){
    perm = await Notification.requestPermission();
  }
  if(perm !== 'granted') return alert('Benachrichtigungen nicht erlaubt.');
  new Notification('Benachrichtigungen aktiviert');
}

// ---------- PWA helpers
// nothing extra here

