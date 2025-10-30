import { socket, elements, log } from "./config.js";
import { handleScreenUpdate, setLoading, showCopyPopup, updateQueue } from "./ui.js";

export function setupSocket() {
    socket.on("loading-start", (msg) => setLoading(true, msg));
    socket.on("loading-end", (msg) => setLoading(false, msg));

    socket.on("screen", data => {
        handleScreenUpdate(data);
    });

    socket.on("update-url", newUrl => {
        elements.urlInput.value = newUrl;
        log("Socket: URL updated to", newUrl);
    });

    socket.on("queue-update", queue => {
        updateQueue(queue, socket.id);
        log("Socket: Queue updated", queue);
    });

    socket.on("clipboard-copy", async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.warn("Clipboard write failed, showing fallback:", err);

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

            showCopyPopup(text);
        }
    });

}

