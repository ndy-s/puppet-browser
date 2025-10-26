import { socket, elements, updateState } from "./config.js";

export function initResize() {
    new ResizeObserver(() => {
        updateState({
            clientWidth: elements.screen.clientWidth,
            clientHeight: elements.screen.clientHeight
        });

        socket.emit("screen-size", {
            w: elements.screen.clientWidth,
            h: elements.screen.clientHeight
        });
    }).observe(elements.screen);
}


