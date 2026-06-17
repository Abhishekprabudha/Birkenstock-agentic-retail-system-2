const DATA_FILES = {
  manifest: './data/manifest.json',
  stores: './data/stores.json',
  skus: './data/sku_catalog.json',
  channels: './data/channels.json',
  warehouses: './data/warehouses.json',
  inventory: './data/inventory_snapshot.json',
  sales: './data/sales_history.json',
  kpis: './data/historical_kpis.json',
  variances: './data/inventory_variances.json',
  returns: './data/returns_history.json',
  scenarios: './data/scenarios.json',
  rules: './data/agent_rules.json',
  audit: './data/audit_log.json'
};
const STORAGE_KEY = 'birkenstock_agentic_retail_state_v3';
let base = {};
let state = {
  inventory: [], audit: [], recommendations: [], eventLog: [], activeScenario: null,
  scenarioMultipliers: { STORE: 1, D2C: 1, MYN: 1, NYK: 1, AMZ: 1 },
  paused: false, approvedValue: 0, manualHoursSaved: 0
};
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-IN');
const money = (n) => '₹' + fmt.format(Math.round(n));
const lakh = (n) => '₹' + (n / 100000).toFixed(1) + 'L';
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function init() {
  try {
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([k, path]) => [k, await loadJson(path)]));
    base = Object.fromEntries(entries);
    restoreState();
    if (!state.eventLog.length) pushEvent('UniStack DataOps', 'Static JSON feeds loaded from /data. Retail twin is online.');
    wireEvents();
    populateFilters();
    renderAll();
    startRealtimeLoop();
  } catch (err) {
    document.body.innerHTML = `<main class="panel" style="margin:40px"><h1>Data load failed</h1><p>${err.message}</p><p>Run via GitHub Pages or a local static server. Some browsers block JSON fetches from file://.</p></main>`;
  }
}

function restoreState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      if (!state.inventory?.length) state.inventory = structuredClone(base.inventory);
      if (!state.audit?.length) state.audit = structuredClone(base.audit);
      return;
    } catch (_) {}
  }
  state.inventory = structuredClone(base.inventory);
  state.audit = structuredClone(base.audit);
  state.recommendations = [];
  state.eventLog = [];
  state.approvedValue = 0;
  state.manualHoursSaved = 0;
}

function saveState() {
  const compact = {
    inventory: state.inventory,
    audit: state.audit,
    recommendations: state.recommendations,
    eventLog: state.eventLog.slice(0, 120),
    activeScenario: state.activeScenario,
    scenarioMultipliers: state.scenarioMultipliers,
    approvedValue: state.approvedValue,
    manualHoursSaved: state.manualHoursSaved
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
}

function pushEvent(agent, message, severity = 'info') {
  state.eventLog.unshift({ ts: new Date().toISOString(), time: nowTime(), agent, message, severity });
  state.eventLog = state.eventLog.slice(0, 100);
  saveState();
}

function wireEvents() {
  document.body.addEventListener('click', (e) => {
    const scenario = e.target.closest('[data-scenario]')?.dataset?.scenario;
    if (scenario) activateScenario(scenario);
    const scroll = e.target.closest('[data-scroll]')?.dataset?.scroll;
    if (scroll) $(scroll)?.scrollIntoView({ behavior: 'smooth' });
    const approveId = e.target.closest('[data-approve]')?.dataset?.approve;
    if (approveId) approveRecommendation(approveId);
    const rejectId = e.target.closest('[data-reject]')?.dataset?.reject;
    if (rejectId) rejectRecommendation(rejectId);
  });
  $('btnRecompute').addEventListener('click', () => { computeRecommendations(); renderAll(); pushEvent('AgentOps Core', 'Agents recomputed recommendations from current retail twin.'); });
  $('btnPause').addEventListener('click', () => { state.paused = !state.paused; $('btnPause').textContent = state.paused ? 'Resume' : 'Pause'; pushEvent('Telemetry', state.paused ? 'Live telemetry paused.' : 'Live telemetry resumed.'); renderFeed(); });
  $('btnExportState').addEventListener('click', exportState);
  $('btnDownloadTwin').addEventListener('click', () => downloadJson('birkenstock-retail-twin-current.json', state.inventory));
  $('btnShowJson').addEventListener('click', () => { $('jsonPreview').textContent = JSON.stringify(getExportPayload(), null, 2); });
  $('btnReset').addEventListener('click', resetDemo);
  $('importState').addEventListener('change', importState);
  $('cityFilter').addEventListener('change', renderRiskRadar);
  $('styleFilter').addEventListener('change', renderRiskRadar);
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  restoreState();
  pushEvent('UniStack AgentOps', 'Demo reset to original synthetic JSON state.');
  computeRecommendations();
  renderAll();
}

function importState(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (payload.state) Object.assign(state, payload.state);
      else Object.assign(state, payload);
      pushEvent('Data Room', 'Imported JSON state and replayed dashboard from uploaded file.');
      computeRecommendations(); renderAll(); saveState();
    } catch (err) { alert('Invalid JSON: ' + err.message); }
  };
  reader.readAsText(file);
}

function getExportPayload() {
  return {
    manifest: base.manifest,
    exported_at: new Date().toISOString(),
    state: {
      activeScenario: state.activeScenario,
      scenarioMultipliers: state.scenarioMultipliers,
      inventory: state.inventory,
      recommendations: state.recommendations,
      audit: state.audit,
      eventLog: state.eventLog,
      approvedValue: state.approvedValue,
      manualHoursSaved: state.manualHoursSaved
    }
  };
}
function exportState() { downloadJson(`birkenstock-agentic-state-${Date.now()}.json`, getExportPayload()); }
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function populateFilters() {
  const cities = ['All cities', ...new Set(base.stores.map(s => s.city))];
  $('cityFilter').innerHTML = cities.map(c => `<option value="${c}">${c}</option>`).join('');
  $('cityFilter').value = 'Mumbai';
  const styles = ['Hero styles', 'Arizona', 'Boston', 'Gizeh', 'Madrid', 'Mayari', 'Milano', 'Zurich'];
  $('styleFilter').innerHTML = styles.map(s => `<option value="${s}">${s}</option>`).join('');
}

function renderAll() {
  renderKpis(); renderScenarios(); renderFeed(); renderRiskRadar(); renderAgentGrid(); renderRecommendations(); renderRetailTwin(); renderVariances(); renderImpact(); renderAudit(); renderDataRoom(); renderHistoryChart();
}

function renderKpis() {
  const risks = getRiskRecords();
  const critical = risks.filter(r => r.hoursCover < 24).length;
  const atRisk = risks.slice(0, 40).reduce((s,r)=>s+r.revenueAtRisk,0);
  const actions = state.recommendations.filter(r => r.status !== 'Rejected').length;
  const avgAcc = avg(base.variances.map(v => v.vision_confidence_pct));
  const kpis = [
    ['50', 'Stores in synthetic India footprint', '+8 Mumbai focus'],
    ['3+', 'Channels unified: stores + D2C + marketplaces', 'single signal'],
    [critical, 'Critical SKU-size risks under 24h cover', state.activeScenario ? 'scenario active' : 'baseline'],
    [lakh(atRisk), 'Revenue at risk now', 'live computed'],
    [state.recommendations.length, 'Open agent recommendations', actions + ' actionable'],
    [avgAcc.toFixed(1)+'%', 'Vision confidence for count AI', 'inventory AI']
  ];
  $('kpiGrid').innerHTML = kpis.map(k => `<div class="kpi-card"><b>${k[0]}</b><span>${k[1]}</span><small>${k[2]}</small></div>`).join('');
}

function renderScenarios() {
  $('scenarioGrid').innerHTML = base.scenarios.map(sc => `
    <div class="scenario-card ${state.activeScenario === sc.scenario_id ? 'active' : ''}">
      <div><h4>${sc.name}</h4><p>${sc.description}</p></div>
      <div><div class="tag-row">${sc.impacted_styles.map(s => `<span class="tag">${s}</span>`).join('')}<span class="tag">${sc.duration_hours}h</span></div><br><button class="primary" data-scenario="${sc.scenario_id}">${state.activeScenario===sc.scenario_id?'Replay Scenario':'Activate Scenario'}</button></div>
    </div>`).join('');
}

function activateScenario(id) {
  const sc = base.scenarios.find(s => s.scenario_id === id);
  state.activeScenario = id;
  state.scenarioMultipliers = { STORE: 1, D2C: 1, MYN: 1, NYK: 1, AMZ: 1, ...sc.channel_multipliers };
  pushEvent('Scenario Engine', `${sc.name} activated. Demand multipliers applied to ${sc.impacted_styles.join(', ')}.`);
  if (id === 'warehouse_receipt_mismatch') pushEvent('Inventory Accuracy Agent', 'Vision detected inbound mismatch: Gizeh / Madrid count variance moved to exception queue.', 'warning');
  if (id === 'return_rush') pushEvent('Returns Restock Agent', 'Grade A returns detected. Restock-to-D2C actions prepared.', 'success');
  computeRecommendations(); renderAll();
}

function getSku(skuId) { return base.skus.find(s => s.sku_id === skuId) || {}; }
function getChannel(ch) { return base.channels.find(c => c.channel_id === ch) || { priority: 1, margin_weight: 1, channel_name: ch }; }
function available(inv) { return Math.max(0, inv.stock_on_hand - inv.reserved + inv.in_transit); }
function adjustedVelocity(inv) { return Math.max(0.05, inv.daily_velocity * (state.scenarioMultipliers[inv.channel_id] || 1)); }
function hoursCover(inv) { return available(inv) / adjustedVelocity(inv) * 24; }
function riskScore(inv) {
  const sku = getSku(inv.sku_id), ch = getChannel(inv.channel_id);
  const hc = hoursCover(inv);
  const stockoutProb = Math.max(0, 1 - hc / 96);
  const heroWeight = sku.tier === 'hero' ? 1.55 : 1.0;
  return Math.round(stockoutProb * adjustedVelocity(inv) * ch.priority * sku.mrp_inr * sku.gross_margin_pct * heroWeight / 1200);
}
function revenueAtRisk(inv) {
  const sku = getSku(inv.sku_id), ch = getChannel(inv.channel_id);
  const demandGap = Math.max(0, adjustedVelocity(inv) * 2 - available(inv));
  return demandGap * sku.mrp_inr * sku.gross_margin_pct * ch.margin_weight;
}

function getRiskRecords() {
  return state.inventory.map(inv => ({ ...inv, available_units: available(inv), adjusted_velocity: adjustedVelocity(inv), hoursCover: hoursCover(inv), riskScore: riskScore(inv), revenueAtRisk: revenueAtRisk(inv) }))
    .filter(r => r.riskScore > 1)
    .sort((a,b) => b.riskScore - a.riskScore);
}

function renderRiskRadar() {
  const city = $('cityFilter')?.value || 'All cities'; const style = $('styleFilter')?.value || 'Hero styles';
  let risks = getRiskRecords().filter(r => ['Arizona','Boston','Gizeh'].includes(r.style));
  if (city !== 'All cities') risks = risks.filter(r => r.city === city);
  if (style !== 'Hero styles') risks = risks.filter(r => r.style === style);
  const top = risks.slice(0, 9);
  $('riskRadar').innerHTML = top.map(r => {
    const pct = Math.max(5, Math.min(100, 100 - r.hoursCover));
    const cls = r.hoursCover < 24 ? 'critical' : r.hoursCover < 72 ? 'warning' : '';
    const status = r.hoursCover < 24 ? 'Stockout <24h' : r.hoursCover < 72 ? 'Watch' : 'Safe';
    return `<div class="risk-card ${cls}">
      <div class="risk-top"><div><h4>${r.style} ${r.color} • ${r.size}</h4><p>${r.location_name} • ${getChannel(r.channel_id).channel_name}</p></div><div class="risk-score">${r.riskScore}</div></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="mini-row"><span>${status}</span><strong>${r.hoursCover.toFixed(1)}h cover</strong></div>
      <div class="mini-row"><span>Available</span><strong>${r.available_units} units</strong></div>
      <div class="mini-row"><span>Revenue risk</span><strong>${money(r.revenueAtRisk)}</strong></div>
    </div>`;
  }).join('') || '<p class="hero-sub">No risks match the current filter.</p>';
}

function computeRecommendations() {
  const risks = getRiskRecords().filter(r => r.hoursCover < 36 && ['Arizona','Boston','Gizeh'].includes(r.style));
  const recs = [];
  for (const dest of risks.slice(0, 12)) {
    const sku = getSku(dest.sku_id);
    const candidates = state.inventory
      .filter(src => src.sku_id === dest.sku_id && src.location_type === 'STORE' && src.city === dest.city && src.location_id !== dest.location_id)
      .map(src => ({ ...src, available_units: available(src), sourceCover: hoursCover(src) }))
      .filter(src => src.available_units >= 4 && src.sourceCover > 96)
      .sort((a,b) => (b.available_units * b.sourceCover) - (a.available_units * a.sourceCover));
    if (!candidates.length) continue;
    const src = candidates[0];
    const needed = Math.max(2, Math.ceil(adjustedVelocity(dest) * 1.8 - available(dest)));
    const qty = Math.min(needed, Math.max(1, src.available_units - Math.ceil(adjustedVelocity(src) * 3)));
    if (qty <= 0) continue;
    const protectedValue = qty * sku.mrp_inr * sku.gross_margin_pct * getChannel(dest.channel_id).margin_weight;
    const confidence = Math.min(96, Math.round(76 + Math.min(18, src.sourceCover/24) + Math.random()*4));
    recs.push({
      id: `REC-${dest.sku_id}-${dest.channel_id}-${Date.now()}-${recs.length}`,
      type: 'Inter-store / channel transfer', agent: 'Transfer Agent + Allocation Agent', sku_id: dest.sku_id,
      style: dest.style, size: dest.size, color: dest.color, from_location_id: src.location_id, from_location_name: src.location_name,
      to_location_id: dest.location_id, to_location_name: dest.location_name, to_channel_id: dest.channel_id, quantity: qty,
      confidence, status: 'Pending approval', revenue_protected_inr: Math.round(protectedValue),
      reason: `${dest.style} ${dest.color} size ${dest.size} has ${dest.hoursCover.toFixed(1)}h cover in ${getChannel(dest.channel_id).channel_name}. ${src.location_name} has ${src.sourceCover.toFixed(0)}h cover and can release stock without falling below policy guardrails.`,
      created_at: new Date().toISOString(),
      mock_objects: []
    });
  }
  // Inventory mismatch recommendation
  if (state.activeScenario === 'warehouse_receipt_mismatch') {
    const v = base.variances.find(x => Math.abs(x.variance_units) >= 2);
    recs.unshift({ id:`REC-VISION-${Date.now()}`, type:'Inventory accuracy exception', agent:'Inventory Accuracy Agent', sku_id:v.sku_id, style:v.style, size:v.size, color:'', from_location_name:v.store_name, to_location_name:'Cycle count queue', quantity:Math.abs(v.variance_units), confidence:Math.round(v.vision_confidence_pct), status:'Pending approval', revenue_protected_inr:0, reason:`Vision count detected ${v.detected_units} units against expected ${v.expected_units}. Block ATP exposure until cycle count is complete.`, created_at:new Date().toISOString(), mock_objects:[] });
  }
  if (state.activeScenario === 'return_rush') {
    const r = base.returns.find(x => x.condition_grade.startsWith('A'));
    recs.unshift({ id:`REC-RETURN-${Date.now()}`, type:'Return-to-restock action', agent:'Returns Restock Agent', sku_id:r.sku_id, style:r.style, size:r.size, color:'', from_location_name:'Return dock', to_location_name:'D2C available-to-promise', quantity:1, confidence:92, status:'Pending approval', revenue_protected_inr:r.estimated_recovery_inr, reason:`Grade A return can be relisted before fresh replenishment. Route to D2C because online velocity is above store velocity under current scenario.`, created_at:new Date().toISOString(), mock_objects:[] });
  }
  state.recommendations = recs.slice(0, 8);
  saveState();
}

function renderRecommendations() {
  if (!state.recommendations.length) computeRecommendations();
  $('recommendations').innerHTML = state.recommendations.map(r => {
    const cls = r.status === 'Approved' ? 'approved' : r.status === 'Rejected' ? 'rejected' : '';
    return `<div class="rec-card ${cls}">
      <div class="rec-head"><div><h4>${r.type}</h4><p>${r.agent} • ${r.style} ${r.color || ''} ${r.size ? 'size '+r.size : ''}</p></div><div class="confidence">${r.confidence}% confidence</div></div>
      <div class="rec-grid">
        <div class="rec-metric"><b>${r.quantity}</b><span>units</span></div>
        <div class="rec-metric"><b>${money(r.revenue_protected_inr)}</b><span>margin / sales protected</span></div>
        <div class="rec-metric"><b>${r.from_location_name}</b><span>source</span></div>
        <div class="rec-metric"><b>${r.to_location_name}</b><span>destination</span></div>
      </div>
      <p>${r.reason}</p>
      ${r.mock_objects?.length ? `<p class="mock">Created: ${r.mock_objects.join(' • ')}</p>` : ''}
      <div class="rec-actions">
        <button class="primary" data-approve="${r.id}" ${r.status!=='Pending approval'?'disabled':''}>Approve action</button>
        <button class="ghost" data-reject="${r.id}" ${r.status!=='Pending approval'?'disabled':''}>Reject</button>
        <span class="status-chip ${r.status==='Approved'?'status-safe':r.status==='Rejected'?'status-critical':'status-watch'}">${r.status}</span>
      </div>
    </div>`;
  }).join('');
}

function approveRecommendation(id) {
  const rec = state.recommendations.find(r => r.id === id); if (!rec || rec.status !== 'Pending approval') return;
  // Transfer action updates retail twin if source/destination are inventory records
  const src = state.inventory.find(i => i.location_id === rec.from_location_id && i.sku_id === rec.sku_id);
  const dest = state.inventory.find(i => i.location_id === rec.to_location_id && i.sku_id === rec.sku_id && i.channel_id === rec.to_channel_id);
  if (src && dest) { src.stock_on_hand = Math.max(0, src.stock_on_hand - rec.quantity); dest.in_transit += rec.quantity; }
  rec.status = 'Approved';
  const sto = `SAP-STO-${Math.floor(100000 + Math.random()*899999)}`;
  const wms = `WMS-PICK-${Math.floor(10000 + Math.random()*89999)}`;
  rec.mock_objects = [sto, wms, 'STORE-INSTRUCTION'];
  state.approvedValue += rec.revenue_protected_inr; state.manualHoursSaved += 2.5;
  const audit = { audit_id: `AUD-${String(state.audit.length+1).padStart(4,'0')}`, timestamp: new Date().toISOString(), agent: rec.agent, event: 'Action approved', decision: `${rec.type}: ${rec.quantity} units of ${rec.sku_id} from ${rec.from_location_name} to ${rec.to_location_name}`, status:'Approved', mock_objects:rec.mock_objects };
  state.audit.unshift(audit);
  pushEvent(rec.agent, `Approved: ${rec.quantity} units ${rec.sku_id}. Created ${sto} and ${wms}.`, 'success');
  saveState(); renderAll();
}
function rejectRecommendation(id) {
  const rec = state.recommendations.find(r => r.id === id); if (!rec) return;
  rec.status = 'Rejected';
  state.audit.unshift({ audit_id:`AUD-${String(state.audit.length+1).padStart(4,'0')}`, timestamp:new Date().toISOString(), agent:'Human-in-the-loop', event:'Recommendation rejected', decision:`Rejected ${rec.type} for ${rec.sku_id}; agent retains evidence for review.`, status:'Rejected' });
  pushEvent('Human-in-the-loop', `Rejected recommendation for ${rec.sku_id}.`, 'warning');
  saveState(); renderAll();
}

function renderAgentGrid() {
  const agents = [
    ['DS','Demand Sensing Agent','Detects online, marketplace and store velocity spikes; predicts stockout countdown.'],
    ['AL','Allocation Agent','Creates one stock pool and prioritizes D2C, store and marketplace by margin, SLA and policy.'],
    ['RP','Replenishment Agent','Calculates replenishment triggers before hero SKU hits zero.'],
    ['TR','Transfer Agent','Finds best store-to-store or store-to-D2C movement under lead-time guardrails.'],
    ['IA','Inventory Accuracy Agent','Uses simulated vision results to flag physical-digital stock mismatch.'],
    ['RR','Returns Restock Agent','Grades returns and routes Grade A units back to available-to-promise.']
  ];
  $('agentGrid').innerHTML = agents.map(a => `<div class="agent-card"><div class="agent-icon">${a[0]}</div><div><b>${a[1]}</b><span>${a[2]}</span></div></div>`).join('');
}

function renderRetailTwin() {
  const rows = getRiskRecords().slice(0, 80);
  $('retailTwinTable').innerHTML = `<thead><tr><th>SKU</th><th>Location</th><th>Channel</th><th>Available</th><th>Velocity</th><th>Cover</th><th>Status</th></tr></thead><tbody>${rows.map(r => {
    const st = r.hoursCover < 24 ? ['Critical','status-critical'] : r.hoursCover < 72 ? ['Watch','status-watch'] : ['Safe','status-safe'];
    return `<tr><td>${r.style} ${r.color} ${r.size}<br><small>${r.sku_id}</small></td><td>${r.location_name}<br><small>${r.city}</small></td><td>${getChannel(r.channel_id).channel_name}</td><td>${r.available_units}</td><td>${r.adjusted_velocity.toFixed(2)}/day</td><td>${r.hoursCover.toFixed(1)}h</td><td><span class="status-chip ${st[1]}">${st[0]}</span></td></tr>`;
  }).join('')}</tbody>`;
}

function renderVariances() {
  $('varianceList').innerHTML = base.variances.slice(0, 10).map(v => `<div class="variance"><b>${v.style} size ${v.size} • ${v.store_name}</b><span>Expected ${v.expected_units}, detected ${v.detected_units} (${v.variance_units > 0 ? '+' : ''}${v.variance_units}). Confidence ${v.vision_confidence_pct}%.</span><span>${v.action}</span></div>`).join('');
}

function renderImpact() {
  const avoided = state.recommendations.filter(r => r.status === 'Approved').length || 0;
  const baselineStockouts = base.kpis.slice(-14).reduce((s,k)=>s+k.stockout_events,0);
  const projectedReduction = Math.min(70, avoided*12 + (state.activeScenario ? 28 : 8));
  const cards = [
    [money(state.approvedValue || getRiskRecords().slice(0,4).reduce((s,r)=>s+r.revenueAtRisk,0)), 'Revenue / margin protected by current actions'],
    [projectedReduction+'%', 'Projected stockout-event reduction under pilot'],
    [(96.2 + Math.min(2.6, avoided*.7)).toFixed(1)+'%', 'Simulated fill-rate after approved actions'],
    [state.manualHoursSaved.toFixed(1), 'Manual ops hours avoided this run'],
    [baselineStockouts, '14-day baseline stockout events'],
    ['<5 min', 'Target data freshness for connected signal']
  ];
  $('impactGrid').innerHTML = cards.map(c => `<div class="impact-card"><b>${c[0]}</b><span>${c[1]}</span></div>`).join('');
}

function renderAudit() {
  $('auditList').innerHTML = state.audit.slice(0, 18).map(a => `<div class="audit"><b>${a.event} • ${a.agent}</b><span>${new Date(a.timestamp).toLocaleString('en-IN')} — ${a.decision}</span>${a.mock_objects ? `<div class="mock">${a.mock_objects.join(' • ')}</div>` : ''}</div>`).join('');
}

function renderFeed() {
  $('eventFeed').innerHTML = state.eventLog.slice(0, 28).map(e => `<div class="feed-item"><time>${e.time}</time><strong>${e.agent}</strong><span>${e.message}</span></div>`).join('');
}

function renderDataRoom() {
  const links = [
    ['stores.csv','50-store India footprint'], ['sku_catalog.csv','Hero and core SKU-size catalogue'], ['inventory_snapshot.csv','Synthetic SAP / POS / WMS inventory'], ['sales_history.csv','120-day historical sales feed'], ['historical_kpis.csv','90-day KPI baseline'], ['inventory_variances.csv','Vision cycle count exceptions'], ['returns_history.csv','Returns grading history'], ['../manifest.json','JSON manifest']
  ];
  $('dataSheets').innerHTML = links.map(([file, desc]) => {
    const href = file.endsWith('.json') ? './data/manifest.json' : `./data/sheets/${file}`;
    return `<a class="sheet-link" href="${href}" download><b>${file}</b><span>${desc}</span></a>`;
  }).join('');
}

function renderHistoryChart() {
  const data = base.kpis.slice(-45);
  const w = 660, h = 220, pad = 30;
  const fillVals = data.map(d => d.fill_rate_pct); const stockVals = data.map(d => d.stockout_events);
  const maxStock = Math.max(...stockVals);
  const x = i => pad + i * ((w - pad*2) / (data.length - 1));
  const yFill = v => h - pad - ((v - 88) / 12) * (h - pad*2);
  const path = fillVals.map((v,i) => `${i?'L':'M'}${x(i)},${yFill(v)}`).join(' ');
  const bars = stockVals.map((v,i) => {
    const bw = (w - pad*2) / data.length * .6; const bh = (v/maxStock) * 75;
    return `<rect class="stock-bars" x="${x(i)-bw/2}" y="${h-pad-bh}" width="${bw}" height="${bh}" rx="3"/>`;
  }).join('');
  $('historyChart').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Historical fill rate and stockout event chart"><line class="axis" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"/><line class="axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}"/>${bars}<path class="fill-line" d="${path}"/><text x="${pad}" y="18" fill="#d8a74a" font-size="12" font-weight="800">Fill-rate line</text><text x="${w-190}" y="18" fill="#8cbfff" font-size="12" font-weight="800">Stockout bars</text></svg>`;
}

function startRealtimeLoop() {
  setInterval(() => {
    if (state.paused) return;
    const agents = ['Demand Sensing Agent','Allocation Agent','Replenishment Agent','Transfer Agent','Inventory Accuracy Agent','Returns Restock Agent','UniStack DataOps'];
    const top = getRiskRecords()[Math.floor(Math.random()*Math.min(20, getRiskRecords().length))];
    if (!top) return;
    const messages = [
      `Observed ${top.style} size ${top.size} velocity at ${top.adjusted_velocity.toFixed(1)}/day in ${getChannel(top.channel_id).channel_name}.`,
      `${top.location_name} cover updated to ${top.hoursCover.toFixed(1)}h for ${top.sku_id}.`,
      `Policy check complete: margin priority ${getSku(top.sku_id).gross_margin_pct} and channel priority ${getChannel(top.channel_id).priority}.`,
      `Audit heartbeat saved. Pipeline freshness simulated at ${(2+Math.random()*2.8).toFixed(1)} minutes.`
    ];
    pushEvent(agents[Math.floor(Math.random()*agents.length)], messages[Math.floor(Math.random()*messages.length)]);
    renderKpis(); renderFeed(); renderRiskRadar();
  }, 5200);
}

function avg(arr) { return arr.reduce((a,b)=>a+b,0) / (arr.length || 1); }

init();
