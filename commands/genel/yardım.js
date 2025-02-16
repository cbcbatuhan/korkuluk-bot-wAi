const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'yardım',
    aliases: ['help', 'h'],
    category: 'genel',
    description: 'Komutlar hakkında bilgi verir',
    usage: 'yardım [komut adı]',
    run: async (client, message, args) => {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🤖 Bot Komutları')
            .setTimestamp()
            .setFooter({ text: `${message.author.tag} tarafından istendi`, iconURL: message.author.displayAvatarURL() });

        // Eğer spesifik bir komut soruluyorsa
        if (args[0]) {
            const command = client.commands.get(args[0]) || client.commands.get(client.aliases.get(args[0]));
            
            if (!command) {
                return message.reply('❌ Böyle bir komut bulunamadı!');
            }

            embed.setTitle(`📖 ${command.name.charAt(0).toUpperCase() + command.name.slice(1)} Komutu`);
            embed.addFields([
                { name: '📝 Açıklama', value: command.description || 'Açıklama bulunmuyor' },
                { name: '⌨️ Kullanım', value: command.usage || 'Kullanım bilgisi bulunmuyor' },
                { name: '🔄 Alternatifler', value: command.aliases ? command.aliases.join(', ') : 'Alternatif bulunmuyor' }
            ]);

            return message.channel.send({ embeds: [embed] });
        }

        // Tüm kategorileri göster
        const categories = new Map();

        client.commands.forEach(cmd => {
            const category = cmd.category || 'Diğer';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push(cmd.name);
        });

        categories.forEach((commands, category) => {
            if (category && commands.length > 0) { // Kategori ve komut kontrolü
                embed.addFields({
                    name: `${getCategoryEmoji(category)} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                    value: commands.join(', ')
                });
            }
        });

        embed.setDescription('Detaylı bilgi için: `!yardım <komut adı>`');
        message.channel.send({ embeds: [embed] });
    }
};

// Kategori emojileri
function getCategoryEmoji(category) {
    const emojis = {
        'genel': '⚙️',
        'muzik': '🎵',
        'eglence': '🎮',
        'moderasyon': '🛡️',
        'diğer': '📦'
    };
    return emojis[category.toLowerCase()] || '📌';
} 