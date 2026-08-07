// 周末约球台 —— 零依赖 Node 后端
// 仅使用 Node 内置模块（http / fs / path），无需 npm install。
// 数据存储：同目录下的 data.json（所有人共享，实时读写）。
// 启动：node server.js   （端口取环境变量 PORT，默认 3000）

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- 工具 ----------
function d2s(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// 返回从 from 起「下一个」目标星期几的日期（0=周日 … 6=周六），不含今天
function nextWeekday(from, target) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let add = (target - d.getDay() + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}
function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------- 数据持久化 ----------
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && Array.isArray(obj.slots) && Array.isArray(obj.signups)) return obj;
    }
  } catch (e) {
    console.error('读取 data.json 失败，使用种子数据：', e.message);
  }
  const seedData = seed();
  saveData(seedData);
  return seedData;
}
function saveData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}
// 预置示例数据：1 个已确认场次 + 1 个候选 + 1 个已逾期候选（演示「待处理」）
function seed() {
  const now = new Date();
  const sat = nextWeekday(now, 6);
  const sun = nextWeekday(now, 0);
  const lastSat = new Date(sat);
  lastSat.setDate(lastSat.getDate() - 7);
  const t = Date.now();
  return {
    slots: [
      { id: 's1', date: d2s(sat), start: '19:00', end: '21:00', place: '滨江人造草 2 号场', cap: 14, confirmed: true, archived: false },
      { id: 's2', date: d2s(sun), start: '15:00', end: '17:00', place: '城东足球公园 A 场', cap: 10, confirmed: false, archived: false },
      { id: 's3', date: d2s(lastSat), start: '19:00', end: '21:00', place: '滨江人造草 1 号场', cap: 14, confirmed: false, archived: false }
    ],
    signups: [
      { id: 'u1', slotId: 's1', name: '张三', phone: '138****0001', note: '守门员', createdAt: t },
      { id: 'u2', slotId: 's1', name: '李四', phone: '', note: '', createdAt: t },
      { id: 'u3', slotId: 's1', name: '王五', phone: '', note: '带一个球', createdAt: t }
    ]
  };
}

let DATA = loadData();

// ---------- HTTP 辅助 ----------
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); }
      catch (e) { resolve({}); }
    });
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ---------- 静态文件 ----------
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, urlPath);
  // 防目录穿越
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- API ----------
async function handleApi(req, res, pathname) {
  const method = req.method;

  if (pathname === '/api/state' && method === 'GET') {
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/slot' && method === 'POST') {
    const b = await readBody(req);
    if (!b.date || !b.start || !b.place) return sendJSON(res, 400, { error: '缺少必要字段' });
    const slot = {
      id: genId('s'),
      date: String(b.date),
      start: String(b.start),
      end: b.end ? String(b.end) : '',
      place: String(b.place),
      cap: b.cap ? Number(b.cap) : 0,
      confirmed: false,
      archived: false
    };
    DATA.slots.push(slot);
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/signup' && method === 'POST') {
    const b = await readBody(req);
    if (!b.name || !b.slotId) return sendJSON(res, 400, { error: '请填写名字并选择场次' });
    const slot = DATA.slots.find(s => s.id === b.slotId);
    if (!slot) return sendJSON(res, 400, { error: '场次不存在' });
    if (slot.archived) return sendJSON(res, 400, { error: '该场次已归档' });
    const signup = {
      id: genId('u'),
      slotId: b.slotId,
      name: String(b.name).slice(0, 20),
      phone: b.phone ? String(b.phone).slice(0, 20) : '',
      note: b.note ? String(b.note).slice(0, 40) : '',
      createdAt: Date.now()
    };
    DATA.signups.push(signup);
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/slot/confirm' && method === 'POST') {
    const b = await readBody(req);
    const slot = DATA.slots.find(s => s.id === b.id);
    if (!slot) return sendJSON(res, 404, { error: '场次不存在' });
    slot.confirmed = !slot.confirmed;
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/slot/archive' && method === 'POST') {
    const b = await readBody(req);
    const slot = DATA.slots.find(s => s.id === b.id);
    if (!slot) return sendJSON(res, 404, { error: '场次不存在' });
    slot.archived = !slot.archived;
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/signup/remove' && method === 'POST') {
    const b = await readBody(req);
    DATA.signups = DATA.signups.filter(u => u.id !== b.id);
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/import' && method === 'POST') {
    const b = await readBody(req);
    if (!b || !Array.isArray(b.slots) || !Array.isArray(b.signups)) {
      return sendJSON(res, 400, { error: '格式错误' });
    }
    DATA = { slots: b.slots, signups: b.signups };
    saveData(DATA);
    return sendJSON(res, 200, DATA);
  }

  if (pathname === '/api/reset' && method === 'POST') {
    const b = await readBody(req);
    if (b.confirm !== true) return sendJSON(res, 400, { error: '需确认' });
    DATA = seed();
    return sendJSON(res, 200, DATA);
  }

  return sendJSON(res, 404, { error: '未知接口' });
}

// ---------- 路由 ----------
const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(e => {
      console.error(e);
      sendJSON(res, 500, { error: '服务器错误' });
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`周末约球台已启动： http://localhost:${PORT}`);
});
