import express from 'express';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import BrowserController from './lib/browser.js';
import ControlQueue from './lib/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new IOServer(server);

app.use(express.static(path.join(__dirname, 'public')));

const browser = new BrowserController(io);
const queue = new ControlQueue(io);

io.on('connection', async socket => {
    console.log('Client connected:', socket.id);
    queue.add(socket.id);

    socket.emit('queue-update', queue.list());

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        queue.remove(socket.id);
    });

    socket.on('control-event', event => {
        if (queue.current() !== socket.id) return;
        browser.handleInput(event);
    });

    socket.on('navigate', url => {
        if (queue.current() !== socket.id) return;
        browser.navigate(url);
    });

    socket.on('nav-back', () => {
        if (queue.current() !== socket.id) return;
        browser.handleButton('back');
    });

    socket.on('nav-forward', () => {
        if (queue.current() !== socket.id) return;
        browser.handleButton('forward');
    });

    socket.on('nav-refresh', () => {
        if (queue.current() !== socket.id) return;
        browser.handleButton('refresh');
    });

    socket.on("screen-size", size => {
        browser.setClientResolution(size.w, size.h);
    });

    socket.on('release-control', () => {
        queue.next();
    });
});

server.listen(3000, async () => {
    await browser.launch();
    console.log('Server ready http://localhost:3000');
});


