import { socket, elements, log } from "./config.js";
import { handleScreenUpdate, setLoading, updateQueue } from "./ui.js";

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
            console.error("Failed to write to clipboard:", err);

            showCopyPopup(text);
        }
    });

    function showCopyPopup(text) {
        const overlay = document.createElement('div');
        overlay.className = 'paste-overlay';

        const box = document.createElement('div');
        box.className = 'paste-box';

        box.innerHTML = `
            <h3 class="paste-title">Manual Copy</h3>
            <p class="paste-desc">
                Clipboard access isn’t available in this network.<br>
                Please copy the text below manually.
            </p>
            <textarea class="paste-input" readonly>${text}</textarea>
            <div class="paste-actions">
                <button id="copyCloseBtn" class="btn primary">OK</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const textarea = box.querySelector('.paste-input');
        const closeBtn = box.querySelector('#copyCloseBtn');

        textarea.focus();
        textarea.select();

        closeBtn.onclick = () => overlay.remove();
    }
}

