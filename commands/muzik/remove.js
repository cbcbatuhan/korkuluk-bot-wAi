const { queues } = require('./queue.js');

module.exports = {
    name: 'remove',
    category: 'muzik',
    description: 'Kuyruktan şarkı siler',
    usage: 'remove <numara>',
    run: async (client, message, args) => {
        const queue = queues.get(message.guild.id);
        
        if (!queue || !queue.playing) {
            return message.reply('❌ Şu anda çalan bir müzik yok!');
        }

        if (!message.member.voice.channel) {
            return message.reply('❌ Bir ses kanalında olmalısınız!');
        }

        if (!args[0]) {
            return message.reply('❌ Silmek istediğiniz şarkının numarasını belirtin!');
        }

        const index = parseInt(args[0]) - 2; // -2 çünkü şu an çalan şarkı 1. sırada
        if (isNaN(index) || index < 0 || index >= queue.songs.length) {
            return message.reply('❌ Geçersiz şarkı numarası!');
        }

        const removedSong = queue.songs.splice(index, 1)[0];
        message.channel.send(`✅ **${removedSong.title}** kuyruktan silindi!`);
    }
}; 