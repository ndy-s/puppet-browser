import { socket, elements, state, updateState } from "./config.js";
import { ensureControl } from "./ui.js";

function getXY(e) {
    const rect = elements.screen.getBoundingClientRect();
    return {
        x: ((e.clientX - rect.left) / rect.width) * state.clientWidth,
        y: ((e.clientY - rect.top) / rect.height) * state.clientHeight
    };
}

export function initControls() {
    elements.wrapper.setAttribute("tabindex", "0");
    elements.wrapper.addEventListener("mousedown", () => elements.wrapper.focus());

    elements.screen.addEventListener("mousedown", e => {
        if (!ensureControl(e)) return;
        updateState({ mouseDown: true });
        socket.emit("control-event", { type: "mouse", action: "down", ...getXY(e) });
    });

    elements.screen.addEventListener("mouseup", e => {
        if (!state.mouseDown) return;
        updateState({ mouseDown: false });
        socket.emit("control-event", { type: "mouse", action: "up", ...getXY(e) });
    });

    elements.screen.addEventListener("mousemove", e => {
        if (!state.mouseDown || !ensureControl(e)) return;
        socket.emit("control-event", { type: "mouse", action: "move", ...getXY(e) });
    });

    elements.screen.addEventListener("wheel", e => {
        if (!ensureControl(e)) return;
        socket.emit("control-event", { type: "wheel", deltaY: e.deltaY });
    });

    elements.wrapper.addEventListener("keydown", sendKey);
    elements.wrapper.addEventListener("keyup", sendKey);
}

async function sendKey(e) {
    if (!ensureControl(e)) return;
    if (document.activeElement === elements.urlInput) return;

    const isChar = e.key.length === 1;
    const action = e.type;

    const isPasteShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v';
    if (isPasteShortcut) {
        e.preventDefault();

        if (e.type === 'keydown') {
            try {
                const text = await navigator.clipboard.readText();

                sendClipboardText(text, e);
            } catch (err) {
                console.warn("Clipboard read failed, falling back to manual paste:", err);

                const text = await showPastePopup();
                if (text && text.trim() !== "") sendClipboardText(text, e);

                elements.wrapper.focus();
            }
        }

        return;
    }

    socket.emit("control-event", {
        type: "keyboard",
        action,
        key: e.key,
        code: e.code,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        isChar
    });

    e.preventDefault();
}

function sendClipboardText(text, e) {
    socket.emit("control-event", {
        type: "keyboard",
        action: "keyup",
        key: "Control",
        code: "KeyV",
        shift: false,
        ctrl: true,
        alt: false,
        meta: false,
        isChar: false,
    });

    socket.emit("control-event", {
        type: "keyboard",
        action: "keydown",
        key: text,
        code: e.code,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        isChar: true,
    });
}

function showPastePopup() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'paste-overlay';

        const box = document.createElement('div');
        box.className = 'paste-box';

        box.innerHTML = `
            <h3 class="paste-title">Manual Paste</h3>
            <p class="paste-desc">
                Clipboard access isn’t available in this network.<br>
                Paste your text below and press <b>Send</b>.
            </p>
            <textarea id="manualPasteInput" class="paste-input" rows="4" placeholder="Paste text here..."></textarea>
            <div class="paste-actions">
                <button id="pasteConfirmBtn" class="btn primary">Send</button>
                <button id="pasteCancelBtn" class="btn secondary">Cancel</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const input = box.querySelector('#manualPasteInput');
        const confirm = box.querySelector('#pasteConfirmBtn');
        const cancel = box.querySelector('#pasteCancelBtn');

        input.focus();

        confirm.onclick = () => {
            const value = input.value;
            overlay.remove();
            resolve(value);
        };

        cancel.onclick = () => {
            overlay.remove();
            resolve(null);
        };
    });
}
