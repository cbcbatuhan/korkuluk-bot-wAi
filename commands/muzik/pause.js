const { queues } = require('./queue.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    name: 'pause',
    category: 'muzik',
    description: 'Müziği duraklatır/devam ettirir',
    usage: 'pause',
    run: async (client, message, args) => {
        const queue = queues.get(message.guild.id);
        
        if (!queue || !queue.playing) {
            return message.reply('❌ Şu anda çalan bir müzik yok!');
        }

        if (!message.member.voice.channel) {
            return message.reply('❌ Bir ses kanalında olmalısınız!');
        }

        if (queue.player.state.status === AudioPlayerStatus.Playing) {
            queue.player.pause();
            message.channel.send('⏸️ Müzik duraklatıldı!');
        } else {
            queue.player.unpause();
            message.channel.send('▶️ Müzik devam ediyor!');
        }
    }
}; 