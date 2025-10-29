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

export function showCopyPopup(text) {
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

export function showPastePopup() {
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
