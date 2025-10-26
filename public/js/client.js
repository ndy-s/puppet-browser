import { setupSocket } from "./socket.js";
import { initNavigation } from "./navigation.js";
import { initControls } from "./control.js";
import { initResize } from "./resize.js";

window.addEventListener("DOMContentLoaded", () => {
    setupSocket();
    initNavigation();
    initControls();
    initResize();
});


