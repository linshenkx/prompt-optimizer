// The fixture uses browser IndexedDB, NOT product Dexie or real model/favorite data.
const $ = (id) => document.getElementById(id);
const config = await (await fetch('/demo/config')).json();
const instanceId = crypto.randomUUID();
const dbName = `POBridgeExperiment-${config.runId}`;
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('samples', { keyPath: 'id' });
  request.onerror = () => reject(request.error);
  request.onsuccess = () => resolve(request.result);
});
await new Promise((resolve, reject) => {
  const tx = db.transaction('samples', 'readwrite');
  tx.objectStore('samples').put({ id: 'fixture-only', title: `Known sample ${config.label}`, marker: config.label });
  tx.oncomplete = resolve;
  tx.onerror = () => reject(tx.error);
});
document.title = `Chrome bridge fixture ${config.label}`;
$('identity').textContent = JSON.stringify({ origin: location.origin, instanceId, dbName, label: config.label });
$('connect').disabled = false;
const output = (value) => { $('output').textContent = JSON.stringify(value, null, 2); };
let connection;
let pollTimer;
let generation = 0;
const running = new Map();

async function post(url, data = {}, token, keepalive = false) {
  const response = await fetch(url, {
    method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', keepalive,
    targetAddressSpace: 'loopback', signal: AbortSignal.timeout(4_000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

async function refresh() {
  const sources = await (await fetch('/demo/sources')).json();
  const previous = $('source').value;
  $('source').replaceChildren(new Option('Choose a source', ''));
  for (const source of sources) $('source').append(new Option(`${source.origin} | ${source.instanceId}`, source.id));
  if (sources.some((s) => s.id === previous)) $('source').value = previous;
  return sources;
}

async function execute(message, active) {
  const controller = new AbortController();
  running.set(message.requestId, controller);
  try {
    let result;
    if (message.action === 'fixture.list') {
      const samples = await new Promise((resolve, reject) => {
        const request = db.transaction('samples').objectStore('samples').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      result = { executor: instanceId, dbName, samples };
    } else if (message.action === 'fixture.wait') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 10_000);
        controller.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('cancelled')); }, { once: true });
      });
      result = { completed: true };
    } else throw new Error('unsupported_fixture_action');
    if (!controller.signal.aborted && connection === active) {
      await post(`${config.bridgeUrl}/reply`, { requestId: message.requestId, ok: true, result }, active.connectionToken);
    }
  } catch (error) {
    if (!controller.signal.aborted && connection === active) output({ executorError: error.message });
  } finally { running.delete(message.requestId); }
}

function stopLocal() {
  generation++;
  clearTimeout(pollTimer);
  connection = undefined;
  for (const controller of running.values()) controller.abort();
  $('connection').textContent = 'Disconnected';
  $('connect').disabled = false;
  $('disconnect').disabled = true;
}

async function poll(active, currentGeneration) {
  if (generation !== currentGeneration || connection !== active) return;
  try {
    const { messages } = await post(`${config.bridgeUrl}/poll`, {}, active.connectionToken);
    if (generation !== currentGeneration || connection !== active) return;
    for (const message of messages) {
      if (message.type === 'cancel') {
        running.get(message.requestId)?.abort();
        output({ cancelledRequest: message.requestId, executor: instanceId });
      } else void execute(message, active);
    }
    pollTimer = setTimeout(() => poll(active, currentGeneration), 300);
  } catch (error) { if (connection === active) { stopLocal(); output({ disconnected: error.message }); } }
}

$('connect').onclick = async () => {
  $('connect').disabled = true;
  try {
    const { ticket } = await post('/demo/ticket');
    connection = await post(`${config.bridgeUrl}/connect`, { protocol: 'po-bridge-experiment/1', instanceId, kind: 'web-fixture' }, ticket);
    $('connection').textContent = `Connected: ${connection.sourceId}`;
    $('disconnect').disabled = false;
    void poll(connection, ++generation);
    await refresh();
  } catch (error) { stopLocal(); output({ error: error.message }); }
};
$('disconnect').onclick = async () => {
  const active = connection;
  stopLocal();
  if (active) await post(`${config.bridgeUrl}/disconnect`, {}, active.connectionToken).catch(() => {});
  await refresh();
};
$('refresh').onclick = () => refresh().catch((error) => output({ error: error.message }));
for (const [id, path] of [['list', '/demo/run'], ['cancel', '/demo/cancel']]) {
  $(id).onclick = async () => {
    const sourceId = $('source').value;
    if (!sourceId) { output({ error: 'explicit_source_required' }); return; }
    try { output(await post(path, { sourceId })); }
    catch (error) { output({ error: error.message }); }
  };
}
addEventListener('pagehide', () => {
  const active = connection;
  stopLocal();
  db.close();
  if (active) void post(`${config.bridgeUrl}/disconnect`, {}, active.connectionToken, true).catch(() => {});
});
