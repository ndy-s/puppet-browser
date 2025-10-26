import { socket, elements, state } from "./config.js";
import { ensureControl } from "./ui.js";

export function initNavigation() {
    elements.urlInput.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            if (!ensureControl()) return;
            elements.goBtn.click();
        }
    });

    elements.goBtn.onclick = () => {
        if (!ensureControl()) return;
        socket.emit("navigate", elements.urlInput.value);
        
    };
    elements.backBtn.onclick = () => {
        if (!ensureControl()) return;
        socket.emit("nav-back");
    };
    elements.forwardBtn.onclick = () => {
        if (!ensureControl()) return;
        socket.emit("nav-forward");
    };
    elements.refreshBtn.onclick = () => {
        if (!ensureControl()) return;
        socket.emit("nav-refresh");
    };

    window.addEventListener("keydown", e => {
        if (document.activeElement === elements.urlInput) return;
        if (!ensureControl()) return;

        if (e.altKey && e.key === "ArrowLeft") elements.backBtn.click();
        if (e.altKey && e.key === "ArrowRight") elements.forwardBtn.click();
        if (e.key === "F5") elements.refreshBtn.click();
    });
}


