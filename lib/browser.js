import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { applyChromeSpoofs, normalizeUrl, resolveChromePath } from "./utils.js";

puppeteer.use(StealthPlugin());

class BrowserController {
    constructor(io, width = 1280, height = 720) {
        this.io = io;

        // State
        this.page = null;
        this.browser = null;
        this.width = width;
        this.height = height;
        this.clientW = width;
        this.clientH = height;
        this.isNavigating = false;

        this.inputQueue = Promise.resolve();
        this.mouseDown = { 
            left: false, 
            right: false, 
            middle: false 
        };

        this.history = [];
        this.forwardStack = [];

        this.streaming = false;
    }

    log(...args) {
        console.log('[BrowserController]', ...args);
    }

    emitLoading(isLoading, msg) {
        this.io.emit(isLoading ? "loading-start" : "loading-end", msg);
        this.log('Loading:', isLoading, msg || '');
    }

    async launch(startUrl = "https://www.google.com") {
        this.log('Launching browser...');

        const executablePath = await resolveChromePath();

        this.browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: [
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-infobars",
                "--lang=en-US"
            ],
            protocolTimeout: 30000
        });

        const pages = await this.browser.pages();
        this.page = pages[0];

        await this.page.setViewport({
            width: this.width,
            height: this.height,
            deviceScaleFactor: 1
        });
        await applyChromeSpoofs(this.page);

        this.page.on("framenavigated", frame => this._onFrameNavigated(frame));
        this.browser.on("targetcreated", async target => this._onTargetCreated(target));

        await this.navigate(startUrl);
        this.startStreaming();
    }

    async navigate(input) {
        if (!this.page) return;

        const url = normalizeUrl(input);

        try {
            const serverHost = "localhost:3000"; 
            const serverUrl = new URL(url);
            if (serverUrl.host === serverHost) {
                this.log(`[SAFE-NAV] Prevented navigating to own server: ${url}`);
                this.emitLoading(false, "Navigation blocked: own server URL");
                return;
            }
        } catch (err) {
            this.log("[SAFE-NAV] Invalid URL, skipping check:", err.message);
        }

        this.isNavigating = true;
        this.forwardStack = [];
        this.emitLoading(true, "Navigating…");

        try {
            await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        } catch (err) {
            this.log("Navigation error:", err.message);
        } finally {
            this.isNavigating = false;
            this.emitLoading(false);
            this._sendURL();
        }
    }

    async handleButton(action) {
        this.inputQueue = this.inputQueue.then(async () => {
            switch(action) {
                case "back":
                    await this.back();
                    break;
                case "forward":
                    await this.forward();
                    break;
                case "refresh":
                    await this.refresh();
                    break;
                default:
                    this.log("Unknown button action:", action);
            }
            this.log(`Button action processed: ${action}`);
        }).catch(err => {
            this.log("Button queue rejected:", err.message);
        });
    }

     async back() {
        if (!this.page || this.history.length <= 1) return;
        this.isNavigating = true;
        this.emitLoading(true, "Going back…");

        const current = this.history.pop();
        this.forwardStack.push(current);
        const previous = this.history[this.history.length - 1];

        try { 
            await this.page.goto(previous, { waitUntil: "domcontentloaded" }); 
        } catch (err) { 
            this.log("Back error:", err.message); 
        }

        this.isNavigating = false;
        this.emitLoading(false);
        this._sendURL();
    }

    async forward() {
        if (!this.page || this.forwardStack.length === 0) return;
        const next = this.forwardStack.pop();
        this.history.push(next);

        this.isNavigating = true;
        this.emitLoading(true, "Going forward…");

        try { 
            await this.page.goto(next, { waitUntil: "domcontentloaded" }); 
        } catch (err) { 
            this.log("Forward error:", err.message); 
        }

        this.isNavigating = false;
        this.emitLoading(false);
        this._sendURL();
    }

    async refresh() {
        if (!this.page) return;
        this.isNavigating = true;
        this.emitLoading(true, "Refreshing…");

        try { 
            await this.page.reload({ waitUntil: "domcontentloaded" }); 
        } catch (err) { 
            this.log("Refresh error:", err.message); 
        }

        this.isNavigating = false;
        this.emitLoading(false);
        this._sendURL();
    }

    _onFrameNavigated(frame) {
        if (frame !== this.page.mainFrame()) return;

        const url = frame.url();
        this.emitLoading(true);
        this.log("Main frame navigated:", url);

        if (url !== "about:blank" && (!this.history.length || this.history[this.history.length - 1] !== url)) {
            this.history.push(url);
            this.log("[History] Added:", url);
        }
        this._sendURL();
    }

    async _onTargetCreated(target) {
        if (target.type() !== "page") return;

        const newPage = await target.page();
        const oldPage = this.page; 

        this.log("[NEW TAB] Switching to new page:", newPage.url());

        try {
            await newPage.bringToFront();

            this.page = newPage;
            this.page.on("framenavigated", frame => this._onFrameNavigated(frame));

            await this.page.setViewport({
                width: this.width,
                height: this.height,
                deviceScaleFactor: 1
            });

            if (oldPage && !oldPage.isClosed()) {
                await oldPage.close();
                this.log("[OLD TAB] Closed previous page");
            }

        } catch (err) {
            this.log("[NEW TAB] Error handling new page:", err.message);
        }
    }

    async _sendURL() {
        try {
            const url = this.page.url();
            this.io.emit("update-url", url);
        } catch (err) {
            this.log("_sendURL error:", err.message);
        }
    }

    async handleInput(event) {
        if (!this.page || this.page.isClosed?.()) return;

        this.inputQueue = this.inputQueue.then(async () => {
            try {
                switch (event.type) {
                    case "mouse": 
                        await this._handleMouse(event); 
                        break;
                    case "keyboard": 
                        console.log(event);
                        await this._handleKeyboard(event, event.selector); 
                        break;
                    case "wheel": 
                        await this.page.mouse.wheel({ 
                            deltaY: event.deltaY 
                        }); 
                        break;
                    default: 
                        this.log("Unknown input type:", event.type);
                }
            } catch (err) {
                this.log("handleInput error:", err.message);
            }
        }).catch(err => this.log("Input queue rejected:", err.message));
    }

    async _handleMouse(event) {
        const x = (event.x / this.clientW) * this.width;
        const y = (event.y / this.clientH) * this.height;
        await this.page.mouse.move(x, y);

        const button = event.button || "left";
        if (event.action === "down" && !this.mouseDown[button]) {
            await this.page.mouse.down({ button });
            this.mouseDown[button] = true;
        } else if (event.action === "up" && this.mouseDown[button]) {
            await this.page.mouse.up({ button });
            this.mouseDown[button] = false;
        }
    }

    async _handleKeyboard(event, selector) {
        if (selector) {
            try {
                await this.page.focus(selector);
            } catch {}
        } else {
            await this.page.evaluate(() => {
                const active = document.activeElement;
                if (!active || active === document.body) document.body.focus();
            });
        }

        if (event.action === "type") {
            await this.page.keyboard.type(event.key, { delay: 50 });
        } else if (event.action === "down") {
            await this.page.keyboard.down(event.key).catch(() => {});
        } else if (event.action === "up") {
            await this.page.keyboard.up(event.key).catch(() => {});
        }
    }

    setClientRes(w, h) {
        this.clientW = w;
        this.clientH = h;
        this.log("Client resized:", w, h);
    }

    startStreaming() {
        if (this.streaming) return;
        this.streaming = true;

        const loop = async () => {
            if (!this.streaming) return;

            try {
                if (!this.page || this.page.isClosed?.()) {
                    const pages = await this.page?.browser()?.pages() || [];
                    if (pages.length) this.page = pages[0];
                    else { setTimeout(loop, 1000); return; }
                }

                if (!this.isNavigating && this.page.url() !== "about:blank") {
                    try {
                        const buffer = await this.page.screenshot({
                            type: "jpeg",
                            quality: 60,
                            encoding: "base64",
                            timeout: 2000
                        });
                        this.io.emit("screen", `data:image/jpeg;base64,${buffer}`);
                        this.emitLoading(false);
                    } catch (err) {
                        this.log("[STREAM] Screenshot failed:", err.message);
                        this.emitLoading(true, "Screen update failed… retrying");
                    }
                }
            } catch (err) {
                this.log("[STREAM] Unexpected loop error:", err.message);
            } finally {
                setTimeout(loop, 100);
            }
        };

        loop();
        this._attachPageCloseListener();
    }

    _attachPageCloseListener() {
        if (!this.page) return;
        this.page.off("close", this._attachPageCloseListener);
        this.page.on("close", () => {
            this.log("[STREAM] Page closed, restarting...");
            this.streaming = false;
            setTimeout(() => { if (!this.streaming) this.startStreaming(); }, 1000);
        });
    }
}

export default BrowserController;


