const { queueManager } = require('../../utils/QueueManager');

module.exports = {
    name: 'stop',
    category: 'muzik',
    description: 'Müziği durdurur ve kuyruğu temizler',
    usage: 'stop',
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

            // Müziği durdur ve kuyruğu temizle
            queue.songs = [];
            queue.player.stop();

            // Bağlantıyı güvenli bir şekilde kapat
            try {
                if (queue.connection && !queue.connection.state.status === 'destroyed') {
                    queue.connection.destroy();
                }
            } catch (error) {
                console.log('Bağlantı zaten kapatılmış');
            }

            // Kuyruğu temizle
            queueManager.remove(message.guild.id);
            
            message.channel.send('⏹️ Müzik durduruldu ve kuyruk temizlendi!');
        } catch (error) {
            console.error('Stop komutu hatası:', error);
            message.reply('❌ Müzik durdurulurken bir hata oluştu!');
        }
    }
}; 