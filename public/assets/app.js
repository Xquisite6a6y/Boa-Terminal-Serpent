const state = { sessionToken: localStorage.getItem('boaSession') || '', lastEnvelope: null };
const $ = (id) => document.getElementById(id);
function log(value){ $('console').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
function item(title, body, tone=''){ return `<div class="item ${tone}"><strong>${title}</strong><div>${body}</div></div>`; }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
async function request(path, options={}){
  const res = await fetch(path, { headers:{ 'content-type':'application/json', ...(options.headers||{}) }, ...options });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if(!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
async function post(path, body){ return request(path, { method:'POST', body: JSON.stringify(body || {}) }); }
function requireSession(){ if(!state.sessionToken) throw new Error('Create an account or log in first.'); return state.sessionToken; }
function automationSettings(){ return ['daemonAutostart','resourceSharing','intentTranslation','casting','phaseStackMemory'].reduce((out,key)=>{ out[key] = $(`auto-${key}`).checked; return out; },{}); }
function applyAutomation(settings){ if(!settings) return; Object.entries(settings).forEach(([key,value])=>{ const el = $(`auto-${key}`); if(el) el.checked = Boolean(value); }); }
function renderDashboard(data){
  $('session-badge').textContent = data.account ? `${data.account.username} / ${data.account.plan}` : 'Signed in';
  applyAutomation(data.account && data.account.automation);
  const devices = data.devices || [];
  $('device-badge').textContent = devices.length ? `${devices.length} device(s)` : 'Waiting';
  $('device-list').innerHTML = devices.length ? devices.map((d)=>item(d.label || d.id, `Status: <code>${escapeHtml(d.status || 'unknown')}</code><br>Heartbeat: ${escapeHtml(d.lastSeenAt || 'waiting')}<br>BOA: ${escapeHtml(d.signalStatus || 'waiting')}<br>Wrapped/unwrapped: ${d.wrappedCount || 0}/${d.unwrappedCount || 0}`)).join('') : '<div class="empty">No connected devices yet. Click Connect This Device.</div>';
  const signals = data.signals || [];
  $('signal-list').innerHTML = signals.length ? signals.map((s)=>item(s.status || s.direction, `${escapeHtml(s.direction || '')} at ${escapeHtml(s.createdAt || '')}<br>${escapeHtml(s.preview || s.payload || '')}`)).join('') : '<div class="empty">No signals yet.</div>';
}
async function refreshAll(){
  try{
    const config = await request('/api/public-config');
    $('api-dot').className = 'status-dot ok';
    $('api-status').textContent = 'BOA backend online';
    $('hero-summary').textContent = `${config.deploymentDecision.target}: ${config.deploymentDecision.reason}`;
    $('unified-badge').textContent = config.unified && config.unified.unified ? 'Unified' : 'Check needed';
    $('deploy-output').innerHTML = [
      item('AWS target', `${escapeHtml(config.deploymentDecision.target)}<br>${escapeHtml(config.deploymentDecision.reason)}`),
      item('Build/start', `<code>${escapeHtml(config.deploymentDecision.buildCommand)}</code><br><code>${escapeHtml(config.deploymentDecision.startCommand)}</code>`),
      item('Backend components', (config.backendComponents || []).map(c => escapeHtml(c.name)).join('<br>'))
    ].join('');
    $('aletheia-output').innerHTML = item('Unified modules', (config.unified.modules || []).map(m => `${escapeHtml(m.name)} — ${m.fileCount} files`).join('<br>'));
    if(state.sessionToken){ renderDashboard(await request(`/api/dashboard?session=${encodeURIComponent(state.sessionToken)}`)); }
    log('BOA unified UI is ready.');
  } catch(error){ $('api-dot').className = 'status-dot bad'; $('api-status').textContent = 'Backend check failed'; log(error.message); }
}
async function handleForm(form, path){
  const body = Object.fromEntries(new FormData(form).entries());
  const data = await post(path, body);
  state.sessionToken = data.sessionToken;
  localStorage.setItem('boaSession', state.sessionToken);
  log(data);
  await refreshAll();
}
function wire(id, handler){ $(id).addEventListener('click', async()=>{ try{ await handler(); } catch(error){ log({ error:error.message }); } }); }
$('signup-form').addEventListener('submit', async(e)=>{ e.preventDefault(); try{ await handleForm(e.currentTarget, '/api/signup'); } catch(error){ log({ error:error.message }); } });
$('login-form').addEventListener('submit', async(e)=>{ e.preventDefault(); try{ await handleForm(e.currentTarget, '/api/login'); } catch(error){ log({ error:error.message }); } });
wire('logout', async()=>{ state.sessionToken=''; localStorage.removeItem('boaSession'); $('session-badge').textContent='Signed out'; log('Signed out.'); await refreshAll(); });
wire('refresh-all', refreshAll);
wire('connect-device', async()=>{ requireSession(); location.href = `/download/installer?platform=auto&session=${encodeURIComponent(state.sessionToken)}`; });
wire('download-installer', async()=>{ requireSession(); location.href = `/download/installer?platform=auto&session=${encodeURIComponent(state.sessionToken)}`; });
wire('start-pairing', async()=>{ const data = await post('/api/pair/start', { sessionToken: requireSession(), deviceName: navigator.platform || 'This device' }); $('pairing-output').innerHTML = item('Pairing code', `<code>${data.code}</code><br>${escapeHtml(data.message)}`); log(data); });
wire('probe-daemon', async()=>{ try{ const res = await fetch('http://127.0.0.1:8788/status'); log({ daemonDetected:true, status: await res.json() }); } catch(error){ log({ daemonDetected:false, nextStep:'Download connector, then open it once.', detail:error.message }); } });
wire('send-signal', async()=>{ const data = await post('/api/boa/send', { sessionToken: requireSession(), message: $('signal-message').value }); state.lastEnvelope = data.envelope; log(data); await refreshAll(); });
wire('receive-demo', async()=>{ if(!state.lastEnvelope){ const wrapped = await post('/api/boa/wrap', { sessionToken: requireSession(), message:'Demo received signal' }); state.lastEnvelope = wrapped.envelope; } const data = await post('/api/boa/receive', { sessionToken: requireSession(), envelope: state.lastEnvelope }); log(data); await refreshAll(); });
wire('run-sandbox', async()=>{ const data = await post('/api/sandbox', { input: $('sandbox-input').value, target:'linux' }); $('sandbox-output').innerHTML = item(data.verdict || 'Sandbox', `${escapeHtml(data.safetyNote || '')}<br>Status: <code>${escapeHtml(data.translated && data.translated.status)}</code>`); log(data); });
wire('reverse-solve', async()=>{ const data = await post('/api/aletheia/reverse-solve', { target:'BOA production security closure' }); $('aletheia-output').innerHTML = data.reversePath.map(s => item(s.step, `${escapeHtml(s.meaning)}<br><code>${escapeHtml(Array.isArray(s.value)?s.value.join(' / '):s.value)}</code>`)).join(''); log(data); });
wire('cyber-builder', async()=>{ const data = await post('/api/aletheia/cyber-app', { target:'Aletheia builds BOA into an advanced cybersecurity product' }); $('aletheia-output').innerHTML = data.capabilityLayers.map(l => item(l.name, `${escapeHtml(l.purpose)}<br><code>${l.implementedNow?'active':'future adapter'}</code>`)).join(''); log(data); });
wire('run-cyber-plan', async()=> $('cyber-builder').click());
wire('unify-plan', async()=>{ const data = await post('/api/aletheia/unify', { target:'fully unified production BOA + Aletheia app' }); $('aletheia-output').innerHTML = data.workspace.modules.map(m => item(m.name, `${escapeHtml(m.runtime)}<br>${m.fileCount} files<br><code>${escapeHtml(m.path)}</code>`)).join(''); log(data); });
wire('show-unified', async()=>{ const data = await request('/api/aletheia/unified'); $('aletheia-output').innerHTML = data.modules.map(m => item(m.name, `${escapeHtml(m.runtime)}<br>${m.fileCount} files<br><code>${escapeHtml(m.path)}</code>`)).join(''); log(data); });
wire('save-automation', async()=>{ const data = await post('/api/automation', { sessionToken: requireSession(), settings: automationSettings() }); log(data); await refreshAll(); });
refreshAll();
