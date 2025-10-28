import { elements, state, updateState } from "./config.js";

const disconnectTimeout = 5000; 
let disconnectTimer = null;

export function setLoading(isLoading, msg = "Loading Remote Screen…") {
    updateState({ loading: isLoading });
    const overlay = elements.loadingOverlay;
    overlay.style.display = isLoading ? "flex" : "none";
    overlay.querySelector(".loading-text").textContent = msg;
    [elements.goBtn, elements.backBtn, elements.forwardBtn].forEach(
        btn => btn.disabled = isLoading
    );
}

export function updateQueue(queue, socketId) {
    const currentId = queue[0];
    const hasControl = socketId === currentId;
    updateState({ hasControl });

    const pos = queue.indexOf(socketId);

    const headerIconFile = hasControl ? "check_circle.svg" : "visibility.svg";
    const headerText = hasControl ? "You are in control" : "View only";

    elements.queueEl.innerHTML = `
        <img class="icon" src="assets/icons/${headerIconFile}" alt="${headerText}" 
             style="width:16px; height:16px; vertical-align:middle; margin-right:4px;">
        ${headerText}
    `;

    elements.queueEl.classList.toggle("control", hasControl);
    elements.queueEl.classList.toggle("view-only", !hasControl);

    if (hasControl) {
        elements.bannerEl.classList.remove("visible");
        elements.wrapper.classList.remove("view-only");
    } else {
        let bannerText = "";
        if (pos === -1) {
            bannerText = "Not in the queue. Please wait.";
        } else if (pos === 0) {
            bannerText = "You’re next! Please wait.";
        } else {
            bannerText = `You’re #${pos + 1} in the queue. Please wait.`;
        }

        elements.bannerEl.textContent = bannerText;
        elements.bannerEl.classList.add("visible");

        elements.wrapper.classList.add("view-only");
    }
}

export function handleScreenUpdate(data) {
    if (elements.screen.src !== data) {
        elements.screen.src = data;
        updateState({ lastScreenUpdate: Date.now(), disconnected: false });
    }
    resetDisconnectTimer();
}

function resetDisconnectTimer() {
    clearTimeout(disconnectTimer);
    disconnectTimer = setTimeout(() => {
        if (Date.now() - state.lastScreenUpdate > disconnectTimeout) {
            updateState({ disconnected: true });
            setLoading(true, "Disconnected from server...");
        }
    }, disconnectTimeout);
}


export function ensureControl(e) {
    if (!state.hasControl) {
        alert("You are waiting in the queue…");
        return false;
    }
    return !state.loading;

}

