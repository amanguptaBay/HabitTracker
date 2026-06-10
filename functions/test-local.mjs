/**
 * Local integration test against Firebase Emulator Suite.
 *
 * Usage (emulators must already be running):
 *   node test-local.mjs
 */

const PROJECT  = 'habittracker-4feb2';
const AUTH_URL = `http://localhost:9099`;
const FSTORE   = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const API_BASE = `http://localhost:5001/${PROJECT}/us-central1/api`;

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const HEAD = '\x1b[1m\x1b[36m';
const RST  = '\x1b[0m';

let passed = 0, failed = 0;
let token, uid;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function j(res) {
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; }
  catch { return { status: res.status, body: text }; }
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return j(await fetch(`${API_BASE}${path}`, opts));
}

function check(label, status, body, expectStatus, expectFn) {
  const statusOk = status === expectStatus;
  const bodyOk   = expectFn ? expectFn(body) : true;
  const ok       = statusOk && bodyOk;
  if (ok) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`);
    if (!statusOk) console.log(`     expected HTTP ${expectStatus}, got ${status}`);
    if (!bodyOk)   console.log(`     body check failed:`, JSON.stringify(body, null, 2).slice(0, 400));
    failed++;
  }
  return body;
}

// ─── Auth: sign-up anonymously via emulator ───────────────────────────────────

async function signInAnonymous() {
  const res = await fetch(
    `${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error('Auth emulator sign-up failed: ' + JSON.stringify(data));
  return { token: data.idToken, uid: data.localId };
}

// ─── Seed Firestore directly via REST ────────────────────────────────────────

function fsStr(s)  { return { stringValue: s }; }
function fsBool(b) { return { booleanValue: b }; }
function fsInt(n)  { return { integerValue: String(n) }; }
function fsNull()  { return { nullValue: 'NULL_VALUE' }; }
function fsArr(items) { return { arrayValue: { values: items } }; }

async function fsWrite(path, fields) {
  const url = `${FSTORE}/${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Firestore write failed (${res.status}): ${t}`);
  }
}

async function seedData() {
  const base = `users/${uid}`;

  // Settings — timezone
  await fsWrite(`${base}/settings/preferences`, {
    timezone: fsStr('America/New_York'),
  });

  // Routines
  await fsWrite(`${base}/routines/routine-morning`, {
    id:      fsStr('routine-morning'),
    name:    fsStr('Morning'),
    order:   fsInt(0),
    goalIds: fsArr([fsStr('goal-meditate'), fsStr('goal-exercise')]),
  });
  await fsWrite(`${base}/routines/routine-evening`, {
    id:      fsStr('routine-evening'),
    name:    fsStr('Evening'),
    order:   fsInt(1),
    goalIds: fsArr([fsStr('goal-journal')]),
  });

  // Goals
  await fsWrite(`${base}/goals/goal-meditate`, {
    id:        fsStr('goal-meditate'),
    routineId: fsStr('routine-morning'),
    name:      fsStr('Meditate'),
    required:  fsBool(true),
  });
  await fsWrite(`${base}/goals/goal-exercise`, {
    id:        fsStr('goal-exercise'),
    routineId: fsStr('routine-morning'),
    name:      fsStr('Exercise'),
    required:  fsBool(true),
  });
  await fsWrite(`${base}/goals/goal-journal`, {
    id:        fsStr('goal-journal'),
    routineId: fsStr('routine-evening'),
    name:      fsStr('Journal'),
    required:  fsBool(false),
  });
}

// ─── Test suites ─────────────────────────────────────────────────────────────

async function testDiscovery() {
  console.log(`\n${HEAD}── Discovery ──────────────────────────────────────${RST}`);

  const { status: rs, body: routines } = await api('GET', '/routines');
  check('GET /routines → 200', rs, routines, 200,
    b => Array.isArray(b) && b.length === 2);
  check('routines sorted by order', rs, routines, 200,
    b => b[0]?.name === 'Morning' && b[1]?.name === 'Evening');

  const { status: gs, body: goals } = await api('GET', '/goals');
  check('GET /goals → 200', gs, goals, 200,
    b => Array.isArray(b) && b.length === 3);

  const { status: gfs, body: filtered } = await api('GET', '/goals?routineId=routine-morning');
  check('GET /goals?routineId=routine-morning → 2 goals', gfs, filtered, 200,
    b => Array.isArray(b) && b.length === 2);

  const { status: bgs, body: badGoals } = await api('GET', '/goals?routineId=routine-evening');
  check('GET /goals?routineId=routine-evening → 1 goal', bgs, badGoals, 200,
    b => Array.isArray(b) && b.length === 1 && b[0]?.name === 'Journal');
}

async function testEntries() {
  console.log(`\n${HEAD}── Entries ────────────────────────────────────────${RST}`);

  // No entries yet — default date (today in America/New_York)
  const { status: es, body: empty } = await api('GET', '/entries');
  check('GET /entries (default date) → 200 empty array', es, empty, 200,
    b => Array.isArray(b) && b.length === 0);

  // Mark meditate as done
  const { status: ms, body: marked } = await api('PUT', '/entries/goal-meditate',
    { completed: true });
  check('PUT /entries/goal-meditate completed:true → 200', ms, marked, 200,
    b => b?.completed === true && b?.goalId === 'goal-meditate');

  // Mark exercise as failed
  const { status: fs, body: failed } = await api('PUT', '/entries/goal-exercise',
    { completed: false });
  check('PUT /entries/goal-exercise completed:false → 200', fs, failed, 200,
    b => b?.completed === false);

  // List entries — should see both
  const { status: ls, body: list } = await api('GET', '/entries');
  check('GET /entries now returns 2 entries', ls, list, 200,
    b => Array.isArray(b) && b.length === 2);

  // Reset meditate back to null
  const { status: rs, body: reset } = await api('PUT', '/entries/goal-meditate',
    { completed: null });
  check('PUT /entries/goal-meditate completed:null (reset) → 200', rs, reset, 200,
    b => b?.completed === null);

  // Explicit date param
  const { status: ds, body: dated } = await api('PUT',
    '/entries/goal-journal?date=2025-01-15', { completed: true });
  check('PUT /entries/goal-journal?date=2025-01-15 → correct date', ds, dated, 200,
    b => b?.date === '2025-01-15');

  // Validation: bad completed value
  const { status: vs } = await api('PUT', '/entries/goal-meditate', { completed: 'yes' });
  check('PUT /entries with bad "completed" → 400', vs, null, 400);

  // Not found: unknown goal
  const { status: nfs } = await api('PUT', '/entries/goal-does-not-exist', { completed: true });
  check('PUT /entries for unknown goal → 404', nfs, null, 404);
}

async function testTimers() {
  console.log(`\n${HEAD}── Timers ─────────────────────────────────────────${RST}`);

  // No timers yet
  const { status: ls, body: empty } = await api('GET', '/timers');
  check('GET /timers initially empty', ls, empty, 200,
    b => Array.isArray(b) && b.length === 0);

  // Start a goal timer
  const { status: ss, body: started } = await api('POST', '/timers/goal-meditate',
    { targetType: 'goal' });
  check('POST /timers/goal-meditate → 201', ss, started, 201,
    b => b?.targetId === 'goal-meditate' && typeof b?.startedAt === 'string');

  // Start a routine timer concurrently
  const { status: rss, body: rStarted } = await api('POST', '/timers/routine-morning',
    { targetType: 'routine' });
  check('POST /timers/routine-morning (concurrent) → 201', rss, rStarted, 201,
    b => b?.targetType === 'routine');

  // List — should see both
  const { status: tls, body: timers } = await api('GET', '/timers');
  check('GET /timers shows 2 running timers', tls, timers, 200,
    b => Array.isArray(b) && b.length === 2);

  // Duplicate start → 409
  const { status: dups } = await api('POST', '/timers/goal-meditate',
    { targetType: 'goal' });
  check('POST /timers/goal-meditate again → 409 conflict', dups, null, 409);

  // Invalid targetType
  const { status: bts } = await api('POST', '/timers/goal-exercise',
    { targetType: 'habit' });
  check('POST /timers with bad targetType → 400', bts, null, 400);

  // Stop the goal timer
  await new Promise(r => setTimeout(r, 100)); // ensure non-zero duration
  const { status: del, body: stopped } = await api('DELETE', '/timers/goal-meditate');
  check('DELETE /timers/goal-meditate → 200', del, stopped, 200,
    b => b?.stopped === true && Array.isArray(b?.segments) && b.segments.length >= 1);
  check('  segment has positive durationMs', del, stopped, 200,
    b => b?.segments?.[0]?.durationMs > 0);

  // Stop the routine timer
  const { status: rdel, body: rStopped } = await api('DELETE', '/timers/routine-morning');
  check('DELETE /timers/routine-morning → 200', rdel, rStopped, 200,
    b => b?.stopped === true);

  // List — now empty
  const { status: fls, body: finalTimers } = await api('GET', '/timers');
  check('GET /timers after both stopped → empty', fls, finalTimers, 200,
    b => Array.isArray(b) && b.length === 0);

  // Stop non-existent timer → 404
  const { status: nfs } = await api('DELETE', '/timers/goal-meditate');
  check('DELETE /timers for stopped timer → 404', nfs, null, 404);
}

async function testAuth() {
  console.log(`\n${HEAD}── Auth ───────────────────────────────────────────${RST}`);

  const res = await fetch(`${API_BASE}/routines`); // no token
  check('Request with no token → 401', res.status, null, 401);

  const res2 = await fetch(`${API_BASE}/routines`, {
    headers: { Authorization: 'Bearer bogus-token' },
  });
  check('Request with invalid token → 401', res2.status, null, 401);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${HEAD}HabitTracker REST API — Local Integration Tests${RST}`);
  console.log(`API: ${API_BASE}\n`);

  console.log('Signing in via Auth emulator...');
  ({ token, uid } = await signInAnonymous());
  console.log(`uid: ${uid}`);

  console.log('Seeding Firestore test data...');
  await seedData();

  await testAuth();
  await testDiscovery();
  await testEntries();
  await testTimers();

  const total = passed + failed;
  console.log(`\n${HEAD}── Results ────────────────────────────────────────${RST}`);
  console.log(`  ${passed}/${total} passed  ${failed > 0 ? FAIL + ' ' + failed + ' failed' : ''}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
