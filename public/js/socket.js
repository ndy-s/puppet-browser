import { socket, elements, log } from "./config.js";
import {handleScreenUpdate, setLoading, showCopyPopup, updateQueue} from "./ui.js";

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
            showCopyPopup(text);
        }
    });

}

