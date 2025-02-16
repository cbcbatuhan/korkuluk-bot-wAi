const { queueManager } = require('../../utils/QueueManager');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'queue',
    aliases: ['q'],
    category: 'muzik',
    description: 'Müzik kuyruğunu gösterir',
    usage: 'queue',
    run: async (client, message, args) => {
        try {
            const queue = queueManager.get(message.guild.id);
            
            if (!queue || !queue.playing) {
                return message.reply('❌ Şu anda çalan bir müzik yok!');
            }

            const songs = queue.songs;
            if (songs.length === 0 && !queue.currentSong) {
                return message.reply('❌ Kuyrukta şarkı yok!');
            }

            // Embed oluştur
            const embed = new EmbedBuilder()
                .setTitle('🎵 Müzik Kuyruğu')
                .setColor('#5865F2')
                .setTimestamp();

            // Şu an çalan şarkı
            if (queue.currentSong) {
                embed.addFields({
                    name: '▶️ Şu an çalıyor',
                    value: `${queue.currentSong.title}\nİsteyen: ${queue.currentSong.requestedBy}`
                });
            }

            // Kuyrukta bekleyen şarkılar
            if (songs.length > 0) {
                const songList = songs.map((song, index) => 
                    `${index + 1}. ${song.title} | İsteyen: ${song.requestedBy}`
                ).join('\n');

                embed.addFields({
                    name: '📋 Sıradaki Şarkılar',
                    value: songList.length > 1024 ? songList.slice(0, 1021) + '...' : songList
                });
            }

            // Toplam şarkı sayısı
            embed.setFooter({ 
                text: `Toplam ${songs.length + 1} şarkı | ${message.guild.name}` 
            });

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Queue komutu hatası:', error);
            message.reply('❌ Kuyruk görüntülenirken bir hata oluştu!');
        }
    }
}; 