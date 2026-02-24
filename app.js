
const FUNDS_URL = 'funds.json';
// Sätt denna till din Apps Script-proxy URL (se 'gas_proxy_code.gs'). Lämna tom för att bara visa lokala siffror.
const PROXY_BASE_URL = '';

const state = { funds: [], filtered: [] };

const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

function fmtPct(v){
  if(v===null||v===undefined||Number.isNaN(v)) return '–';
  const s = (v>0?'+':'') + v.toFixed(2) + ' %';
  return `<span class="val ${v>0?'good':(v<0?'bad':'')}">${s}</span>`;
}

function render(){
  const tbody = $('#fundTbody');
  tbody.innerHTML = '';
  for(const f of state.filtered){
    const srcLinks = f.kallor.map(k=>`<a href="${k.url}" target="_blank" rel="noopener">${k.namn}</a>`).join(' · ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.namn}</strong><div class="badge">${f.id}</div></td>
      <td>${f.kategori}</td>
      <td>${f.avgift}</td>
      <td>${f.risk}</td>
      <td class="num">${f.utv_i_ar}</td>
      <td class="num">${f.utv_snitt_5ar}</td>
      <td>${f.hallbarhetsrisk}</td>
      <td class="num">${fmtPct(f.perf['1m'])}</td>
      <td class="num">${fmtPct(f.perf['3m'])}</td>
      <td class="num">${fmtPct(f.perf['1y'])}</td>
      <td class="num">${fmtPct(f.perf['2y'])}</td>
      <td class="num">${fmtPct(f.perf['3y'])}</td>
      <td class="source">${srcLinks}</td>
    `;
    tbody.appendChild(tr);
  }
}

function filterFunds(q){
  const s = q.trim().toLowerCase();
  if(!s){ state.filtered = state.funds; render(); return; }
  state.filtered = state.funds.filter(f=>
    f.namn.toLowerCase().includes(s) ||
    f.kategori.toLowerCase().includes(s) ||
    f.risk.toLowerCase().includes(s)
  );
  render();
}

async function fetchFunds(){
  const res = await fetch(FUNDS_URL);
  const data = await res.json();
  state.funds = data;
  state.filtered = data;
  render();
}

async function tryLiveUpdate(){
  if(!PROXY_BASE_URL){ console.info('Ingen proxy angiven – visar lokala siffror.'); return; }
  // Hämta live-data per fond via Apps Script-proxy. Stöd: typ=ft (Financial Times), typ=fm (Fondmarknaden)
  await Promise.all(state.funds.map(async (f)=>{
    try{
      if(f.live && f.live.typ === 'ft' && f.live.isin){
        const url = `${PROXY_BASE_URL}?source=ft&isin=${encodeURIComponent(f.live.isin)}`;
        const r = await fetch(url);
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j = await r.json();
        if(j && j.perf){ f.perf = { ...f.perf, ...j.perf }; }
      } else if(f.live && f.live.typ === 'fm' && f.live.url){
        const url = `${PROXY_BASE_URL}?source=fm&url=${encodeURIComponent(f.live.url)}`;
        const r = await fetch(url);
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j = await r.json();
        if(j && j.perf){ f.perf = { ...f.perf, ...j.perf }; }
      }
    }catch(e){ console.warn('Live-uppdatering misslyckades för', f.id, e); }
  }));
  render();
}

window.addEventListener('DOMContentLoaded', async ()=>{
  $('#year').textContent = new Date().getFullYear();
  await fetchFunds();
  $('#search').addEventListener('input', (e)=>filterFunds(e.target.value));
  $('#refreshBtn').addEventListener('click', ()=>tryLiveUpdate());
});
