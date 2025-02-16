const { queueManager } = require('../../utils/QueueManager');

module.exports = {
    name: 'skip',
    category: 'muzik',
    description: 'Çalan şarkıyı geçer',
    usage: 'skip',
    run: async (client, message, args) => {
        try {
            // Ses kanalı kontrolü
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                return message.reply('❌ Bir ses kanalında olmalısınız!');
            }

            // Kuyruk kontrolü
            const queue = queueManager.get(message.guild.id);
            if (!queue || !queue.playing) {
                return message.reply('❌ Şu anda çalan bir müzik yok!');
            }

            // Bot ses kanalı kontrolü
            const botVoiceChannel = message.guild.members.me.voice.channel;
            if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id) {
                return message.reply('❌ Botla aynı ses kanalında olmalısınız!');
            }

            // Şarkıyı geç
            const currentSong = queue.currentSong?.title || 'Bilinmeyen şarkı';
            queue.player.stop();
            
            // Bilgi mesajı
            const skipMessage = await message.channel.send(`⏭️ **${currentSong}** geçildi!`);

            // Kuyrukta şarkı yoksa bilgi ver
            if (queue.songs.length === 0) {
                setTimeout(() => {
                    skipMessage.edit(`${skipMessage.content}\nℹ️ Kuyrukta başka şarkı yok, müzik duracak.`);
                }, 500);
            }
        } catch (error) {
            console.error('Skip komutu hatası:', error);
            message.reply('❌ Şarkı geçilirken bir hata oluştu!');
        }
    }
}; 