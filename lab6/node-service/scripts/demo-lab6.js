import WebSocket from 'ws';

const BASE = 'http://localhost:3000';

async function run() {
  const ws = new WebSocket('ws://localhost:3000/ws');
  const receivedEvents = [];

  await new Promise((resolve) => {
    ws.on('open', resolve);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      receivedEvents.push(msg);
      if (msg.type !== 'connected') {
        console.log('[WS Broadcast]', JSON.stringify(msg));
      }
    });
  });

  console.log('\n1. CRUD операції (Create -> Duplicate 409 -> Update -> Export -> Delete):');
  const createRes = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Charlie Brown', email: `charlie.${Date.now()}@example.com` })
  });
  const createdUser = await createRes.json();
  console.log('POST /api/users ->', createRes.status, createdUser);

  const dupRes = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate', email: createdUser.email })
  });
  console.log('POST /api/users (duplicate) ->', dupRes.status, await dupRes.json());

  const updRes = await fetch(`${BASE}/api/users/${createdUser.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Charlie Updated' })
  });
  console.log('PUT /api/users/:id ->', updRes.status, await updRes.json());

  console.log('\n2. Stream-експорт користувачів у CSV із WS-прогресом:');
  const expRes = await fetch(`${BASE}/api/users/export`);
  console.log('GET /api/users/export ->', expRes.status, await expRes.json());

  const delRes = await fetch(`${BASE}/api/users/${createdUser.id}`, { method: 'DELETE' });
  console.log('DELETE /api/users/:id ->', delRes.status);

  console.log('\n3. Транзакції PostgreSQL (успішний переказ + ROLLBACK):');
  console.log('Баланси ДО:', await (await fetch(`${BASE}/api/accounts`)).json());

  const txOk = await fetch(`${BASE}/api/accounts/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromAccountId: 1, toAccountId: 2, amount: 150 })
  });
  console.log('Transfer 150 (COMMIT) ->', txOk.status, await txOk.json());

  const txFail = await fetch(`${BASE}/api/accounts/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromAccountId: 1, toAccountId: 2, amount: 999999 })
  });
  console.log('Transfer 999999 (ROLLBACK) ->', txFail.status, await txFail.json());
  console.log('Баланси ПІСЛЯ:', await (await fetch(`${BASE}/api/accounts`)).json());

  console.log('\n4. Polyglot Persistence — останні події з MongoDB (GET /api/events):');
  const events = await (await fetch(`${BASE}/api/events`)).json();
  console.log(`Всього подій у MongoDB: ${events.length}, остання:`, events[0]);

  await new Promise((r) => setTimeout(r, 150));
  ws.close();
}

run();