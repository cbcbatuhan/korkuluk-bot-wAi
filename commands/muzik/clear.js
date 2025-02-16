const { queues } = require('./queue.js');

module.exports = {
    name: 'clear',
    category: 'muzik',
    description: 'Müzik kuyruğunu temizler',
    usage: 'clear',
    run: async (client, message, args) => {
        const queue = queues.get(message.guild.id);
        
        if (!queue || !queue.playing) {
            return message.reply('❌ Şu anda çalan bir müzik yok!');
        }

        if (!message.member.voice.channel) {
            return message.reply('❌ Bir ses kanalında olmalısınız!');
        }

        const songCount = queue.songs.length;
        queue.songs = [];
        
        message.channel.send(`✅ Kuyruktan ${songCount} şarkı temizlendi!`);
    }
}; 