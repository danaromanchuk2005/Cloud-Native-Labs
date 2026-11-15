import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000/ws';
const HTTP_URL = 'http://localhost:3000';

function connectClient(name) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const stats = { name, progressEvents: 0, lastPercent: 0, closedCode: null, closedReason: '' };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', username: name }));
      resolve({ ws, stats });
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString('utf8'));
      if (msg.type === 'progress') {
        stats.progressEvents++;
        stats.lastPercent = msg.percent;
      } else if (msg.type === 'message') {
        console.log(`[${name}] отримав чат-повідомлення від ${msg.from}: "${msg.text}"`);
      } else if (msg.type === 'error') {
        console.log(`[${name}] отримав помилку валідації: ${msg.code} -> ${msg.message}`);
      } else if (msg.type === 'stream_completed') {
        console.log(`[${name}] отримав фінал потоку: оброблено ${msg.linesProcessed.toLocaleString()} рядків за ${msg.durationMs} мс`);
      }
    });

    ws.on('close', (code, reason) => {
      stats.closedCode = code;
      stats.closedReason = reason.toString();
      console.log(`[${name}] з'єднання закрито: code=${code}, reason="${stats.closedReason || 'normal'}"`);
    });
  });
}

async function runDemo() {
  console.log('1. Підключення та автентифікація 3 WebSocket-клієнтів...');
  const c1 = await connectClient('FastClient-1');
  const c2 = await connectClient('FastClient-2');
  const c3 = await connectClient('SlowClient-3');
  await new Promise((r) => setTimeout(r, 100));

  console.log('\n2. Перевірка обміну повідомленнями та обробки невалідного JSON...');
  c1.ws.send(JSON.stringify({ type: 'message', text: 'Hello from FastClient-1!' }));
  c2.ws.send('{invalid-json-message');
  await new Promise((r) => setTimeout(r, 150));

  console.log('\n3. Переведення SlowClient-3 у режим повільного споживача (пауза читання TCP-сокета)...');
  if (c3.ws._socket) {
    c3.ws._socket.pause();
  }

  console.log('4. Запуск потокової обробки файлу (POST /api/streams/process) з трансляцією прогресу в WS...\n');
  const resp = await fetch(`${HTTP_URL}/api/streams/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ highWaterMark: 65536, minRating: 4, includeSample: true })
  });
  const streamSummary = await resp.json();
  console.log('\nHTTP-відповідь сервера:', streamSummary);

  await new Promise((r) => setTimeout(r, 200));
  console.log('\nПідсумкова статистика клієнтів:');
  console.table([c1.stats, c2.stats, c3.stats]);

  c1.ws.close();
  c2.ws.close();
  if (c3.ws.readyState === WebSocket.OPEN) c3.ws.close();
}

runDemo();