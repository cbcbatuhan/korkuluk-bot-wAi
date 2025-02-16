const { AudioPlayerStatus } = require('@discordjs/voice');

class MusicQueue {
    constructor() {
        this.songs = [];
        this.playing = false;
        this.connection = null;
        this.player = null;
        this.currentSong = null;
        this.volume = 0.5;
        this.timeout = null;
    }

    clear() {
        if (this.timeout) clearTimeout(this.timeout);
        if (this.connection) this.connection.destroy();
        if (this.player) this.player.stop();
        this.songs = [];
        this.playing = false;
        this.currentSong = null;
    }
}

class QueueManager {
    constructor() {
        this.queues = new Map();
        this.MAX_QUEUE_SIZE = 50;
        this.MAX_SONG_DURATION = 30;
        this.CLEANUP_TIMEOUT = 5 * 60 * 1000;
    }

    get(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, new MusicQueue());
        }
        return this.queues.get(guildId);
    }

    remove(guildId) {
        const queue = this.queues.get(guildId);
        if (queue) {
            queue.clear();
            this.queues.delete(guildId);
        }
    }

    addSong(guildId, song) {
        const queue = this.get(guildId);
        if (queue.songs.length >= this.MAX_QUEUE_SIZE) {
            throw new Error('Kuyruk limiti aşıldı!');
        }
        queue.songs.push(song);
    }

    startCleanupTimeout(guildId) {
        const queue = this.get(guildId);
        if (queue.timeout) clearTimeout(queue.timeout);
        
        queue.timeout = setTimeout(() => {
            if (!queue.playing && queue.songs.length === 0) {
                this.remove(guildId);
            }
        }, this.CLEANUP_TIMEOUT);
    }
}

// Tek bir instance oluştur
const queueManager = new QueueManager();

module.exports = { queueManager, MusicQueue }; 