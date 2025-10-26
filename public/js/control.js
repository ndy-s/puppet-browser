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

function sendKey(e) {
    if (!ensureControl(e)) return;
    if (document.activeElement === elements.urlInput) return;

    const isChar = e.key.length === 1;
    const action = isChar && e.type === "keydown" ? "type" : e.type === "keydown" ? "down" : "up";

    const active = document.activeElement;
    let selector = null;
    if (active && active !== document.body) {
        if (active.id) selector = `#${active.id}`;
        else if (active.className) selector = `.${active.className.split(' ').join('.')}`;
        else selector = active.tagName.toLowerCase();
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
        selector
    });

    e.preventDefault();
}


