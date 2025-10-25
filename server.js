import express from 'express';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const app = express();
const http = createServer(app);
const io = new IOServer(http, { cors: { origin: '*' } });

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

let browser;
let page = null;                // single shared page
let screenshotInterval = null;
let activeController = null;    // socket.id of controller
const controlQueue = [];        // queue of socket ids awaiting control

async function startBrowser() {
  browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  console.log('Browser started');

  page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36');
  await page.goto('https://example.com', { waitUntil: 'networkidle2' });

  startScreenshotBroadcast();
}

function safeUrl() {
  try { return page?.url() || 'about:blank'; } catch { return 'about:blank'; }
}

function emitState() {
  io.emit('state', {
    url: safeUrl(),
    controller: activeController,
    queue: controlQueue.slice()
  });
}

// Single screenshot broadcaster for the single shared page
function startScreenshotBroadcast() {
  if (screenshotInterval) clearInterval(screenshotInterval);
  screenshotInterval = setInterval(async () => {
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      await page.waitForTimeout(120);
      const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
      const dataUrl = 'data:image/jpeg;base64,' + buf.toString('base64');
      io.emit('frame', { dataUrl });
    } catch (err) {
      console.error('Screenshot error:', err && err.message ? err.message : err);
    }
  }, 150);
}

function isController(socket) {
  return socket.id === activeController;
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // assign first visitor as controller
  if (!activeController) {
    activeController = socket.id;
    socket.emit('role', 'controller');
  } else {
    socket.emit('role', 'viewer');
  }

  // send initial state
  socket.emit('state', { url: safeUrl(), controller: activeController, queue: controlQueue.slice() });

  // queue control request
  socket.on('request-control', () => {
    if (isController(socket)) {
      socket.emit('already-controller');
      return;
    }
    if (!controlQueue.includes(socket.id)) controlQueue.push(socket.id);
    emitState();
    const pos = controlQueue.indexOf(socket.id) + 1;
    socket.emit('queue-position', pos);
  });

  // optional release-control event
  socket.on('release-control', () => {
    if (!isController(socket)) return socket.emit('locked');
    activeController = null;
    if (controlQueue.length > 0) {
      const next = controlQueue.shift();
      activeController = next;
      io.to(activeController).emit('role', 'controller');
    }
    emitState();
  });

  // NAVIGATION: Go button (if not a full URL, perform Google search)
  socket.on('navigate', async ({ url }) => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return socket.emit('nav-error', 'Page not available');
    try {
      // decide if it's a URL or search
      const trimmed = (url || '').trim();
      let target;
      if (/^https?:\/\//i.test(trimmed)) target = trimmed;
      else if (/\s/.test(trimmed) || !trimmed.includes('.') || !/^[^\s]+\.[^\s]+$/.test(trimmed)) {
        // likely search query
        target = 'https://www.google.com/search?q=' + encodeURIComponent(trimmed || '');
      } else {
        // looks like a hostname or domain
        target = trimmed.startsWith('http') ? trimmed : 'http://' + trimmed;
      }

      await page.bringToFront();
      await page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });
      emitState();
    } catch (err) {
      console.error('navigate error', err);
      socket.emit('nav-error', String(err));
    }
  });

  // BACK
  socket.on('go-back', async () => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      await page.goBack({ waitUntil: 'networkidle2' });
      emitState();
    } catch (err) { console.error('goback', err); }
  });

  // REFRESH
  socket.on('refresh', async () => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      await page.reload({ waitUntil: 'networkidle2' });
      emitState();
    } catch (err) { console.error('refresh', err); }
  });

  // CLICK (x,y are coordinates relative to screenshot natural size)
  socket.on('click', async ({ x, y }) => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      await page.evaluate(() => window.focus());
      await page.mouse.click(x, y);
    } catch (err) { console.error('click', err); }
  });

  // SCROLL (relative wheel deltas)
  socket.on('scroll', async ({ deltaX, deltaY }) => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      await page.evaluate(() => window.focus());
      await page.mouse.wheel({ deltaX: deltaX || 0, deltaY: deltaY || 0 });
    } catch (err) { console.error('scroll', err); }
  });

  // TYPING: supports keydown/keyup/press model from client and also paste text
  // event payload examples:
  // { kind: 'press', key: 'Backspace' }
  // { kind: 'down', key: 'Shift' }
  // { kind: 'up', key: 'Shift' }
  socket.on('key', async ({ kind, key, code, modifiers }) => {
    // only controller can send key events
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      // apply modifiers by pressing them down
      // (client may already include modifier flags, but we rely on explicit down/up)
      if (kind === 'press') {
        // press handles modifiers automatically via page.keyboard.press signature
        await page.keyboard.press(key);
      } else if (kind === 'down') {
        await page.keyboard.down(key);
      } else if (kind === 'up') {
        await page.keyboard.up(key);
      }
    } catch (err) { console.error('key event', err); }
  });

  // PASTE: client sends plaintext to paste into page (reliable cross-browser)
  socket.on('paste', async ({ text }) => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      await page.bringToFront();
      // type the pasted text (could be large)
      await page.keyboard.type(text, { delay: 10 });
    } catch (err) { console.error('paste', err); }
  });

  // REQUEST NEW PAGE (not tabs — just navigate to new page)
  // We keep single page; this simply navigates the shared page to example.com or any url
  socket.on('request-new', async ({ url }) => {
    if (!isController(socket)) return socket.emit('locked');
    if (!page || page.isClosed()) return;
    try {
      const target = url && /^https?:\/\//i.test(url) ? url : (url ? 'http://' + url : 'https://example.com');
      await page.bringToFront();
      await page.goto(target, { waitUntil: 'networkidle2', timeout: 30000 });
      emitState();
    } catch (err) { console.error('request-new', err); }
  });

  // RELEASE control explicit
  socket.on('release-control', () => {
    if (!isController(socket)) return socket.emit('locked');
    activeController = null;
    if (controlQueue.length > 0) {
      const next = controlQueue.shift();
      activeController = next;
      io.to(activeController).emit('role', 'controller');
    }
    emitState();
  });

  // handle disconnect: remove from queue; if controller left, promote next
  socket.on('disconnect', () => {
    console.log('client disconnected', socket.id);
    const qi = controlQueue.indexOf(socket.id);
    if (qi !== -1) controlQueue.splice(qi, 1);

    if (socket.id === activeController) {
      activeController = null;
      if (controlQueue.length > 0) {
        const next = controlQueue.shift();
        activeController = next;
        io.to(activeController).emit('role', 'controller');
      }
    }
    emitState();
  });
});

(async () => {
  await startBrowser();
  http.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
})();


