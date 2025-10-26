export default class ControlQueue {
    constructor(io) {
        this.io = io;
        this.clients = [];
        this.index = 0;
    }

    add(clientId) {
        if (!this.clients.includes(clientId)) {
            this.clients.push(clientId);
            this.emit();
        }
    }

    remove(clientId) {
        const i = this.clients.indexOf(clientId);
        if (i >= 0) {
            this.clients.splice(i, 1);
            if (this.index >= this.clients.length) this.index = 0;
            this.emit();
        }
    }

    current() {
        return this.clients[this.index] || null;
    }

    next() {
        this.index = (this.index + 1) % this.clients.length;
        this.emit();
    }

    list() {
        return this.clients;
    }

    emit() {
        this.clients.forEach((clientId, i) => {
            this.io.to(clientId).emit('queue-update', this.clients);
        });
    }
}


