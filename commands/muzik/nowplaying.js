const { queues } = require('./queue.js');

module.exports = {
    name: 'nowplaying',
    aliases: ['np'],
    category: 'muzik',
    description: 'Şu anda çalan şarkıyı gösterir',
    usage: 'nowplaying',
    run: async (client, message, args) => {
        const queue = queues.get(message.guild.id);
        
        if (!queue || !queue.playing) {
            return message.reply('❌ Şu anda çalan bir müzik yok!');
        }

        const song = queue.currentSong;
        message.channel.send(`🎵 Şu anda çalıyor: ${song.title}\n👤 İsteyen: ${song.requestedBy}`);
    }
}; 