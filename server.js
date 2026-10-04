const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
let visitorCount = 0;
let totalTokens = 184320000000000;
let modelLoad = 67;

const COLORS = ['#ff5c2c','#00e5ff','#ff3d7f','#7c4dff','#00c853','#ff9100','#00bcd4','#e040fb'];

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients.keys()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function getOnlineList() {
  const list = [];
  for (const [, info] of clients) {
    list.push({ id: info.id, color: info.color, x: info.x, y: info.y });
  }
  return list;
}

wss.on('connection', (ws) => {
  const id = 'u_' + Math.random().toString(36).slice(2, 9);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const info = { id, color, x: 0, y: 0 };
  clients.set(ws, info);
  visitorCount++;

  ws.send(JSON.stringify({ type: 'welcome', id, color, online: getOnlineList(), visitorCount, totalTokens, modelLoad }));
  broadcast({ type: 'userJoin', id, color, online: getOnlineList(), visitorCount });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      if (data.type === 'cursor') {
        info.x = data.x;
        info.y = data.y;
        broadcast({ type: 'cursor', id, color: info.color, x: data.x, y: data.y });
      }
      if (data.type === 'click') {
        broadcast({ type: 'click', id, color: info.color, x: data.x, y: data.y });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type: 'userLeave', id, online: getOnlineList(), visitorCount: clients.size });
  });
});

setInterval(() => {
  totalTokens += Math.floor(Math.random() * 5000000);
  modelLoad = Math.max(30, Math.min(98, modelLoad + (Math.random() - 0.5) * 6));
  broadcast({ type: 'stats', totalTokens, modelLoad, visitorCount: clients.size });
}, 2000);

app.get('/api/stats', (req, res) => {
  res.json({ visitorCount, totalTokens, modelLoad, online: clients.size });
});

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const phrases = [
    '可修改(SSE流式输出演示文字片段1，自行修改这句话)',
    '可修改(SSE流式输出演示文字片段2，自行修改这句话)',
    '可修改(SSE流式输出演示文字片段3，自行修改这句话)',
    '可修改(SSE流式输出演示文字片段4，自行修改这句话)',
    '可修改(SSE流式输出演示文字片段5，自行修改这句话)'
  ];
  let idx = 0;
  const interval = setInterval(() => {
    if (idx >= phrases.length) {
      res.write('data: [DONE]\n\n');
      clearInterval(interval);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify({ text: phrases[idx] })}\n\n`);
    idx++;
  }, 400);
  req.on('close', () => clearInterval(interval));
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});