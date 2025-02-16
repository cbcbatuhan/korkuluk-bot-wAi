const Warning = require('../../models/Warning');

module.exports = {
    name: 'warn',
    category: 'moderasyon',
    description: 'Kullanıcıyı uyarır',
    permission: 'MANAGE_MESSAGES',
    usage: 'warn <@kullanıcı> [sebep]',
    run: async (client, message, args, settings) => {
        try {
            // Debug log
            console.log('Warn komutu çalıştırıldı');
            console.log('Settings:', settings);
            console.log('Moderation settings:', settings?.moderation);

            // Yetki kontrolü
            if (!message.member.permissions.has('MANAGE_MESSAGES')) {
                return message.reply('❌ Bu komutu kullanmak için yetkiniz yok!');
            }

            // Komut aktif mi kontrolü
            if (!settings?.moderation?.enableWarn) {
                return message.reply('❌ Uyarı komutu bu sunucuda devre dışı!');
            }

            // Log kanalı kontrolü
            if (!settings?.moderation?.logChannel) {
                return message.reply('❌ Moderasyon log kanalı ayarlanmamış!');
            }

            // Hedef kullanıcı kontrolü
            const target = message.mentions.users.first();
            if (!target) {
                return message.reply('❌ Lütfen bir kullanıcı etiketleyin!\nKullanım: `!warn @kullanıcı [sebep]`');
            }

            // Kendini uyaramaz
            if (target.id === message.author.id) {
                return message.reply('❌ Kendinizi uyaramazsınız!');
            }

            // Botu uyaramaz
            if (target.bot) {
                return message.reply('❌ Botları uyaramazsınız!');
            }

            // Sebep
            const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';

            try {
                // Uyarıyı veritabanına kaydet
                const warning = new Warning({
                    guildId: message.guild.id,
                    userId: target.id,
                    moderatorId: message.author.id,
                    reason: reason
                });
                await warning.save();

                // Uyarı mesajı gönder
                await message.channel.send(`✅ ${target.tag} kullanıcısı uyarıldı!\n📝 Sebep: ${reason}`);

                // Moderasyon log gönder
                await client.sendModLog(
                    message.guild.id,
                    'WARN',
                    message.author,
                    target,
                    reason
                );

                // Kullanıcıya DM gönder
                try {
                    const dmEmbed = {
                        color: 0xffff00,
                        title: '⚠️ Uyarı Aldınız!',
                        description: `**${message.guild.name}** sunucusunda uyarıldınız!`,
                        fields: [
                            {
                                name: '📝 Sebep',
                                value: reason
                            },
                            {
                                name: '👤 Moderatör',
                                value: message.author.tag
                            }
                        ],
                        timestamp: new Date()
                    };

                    await target.send({ embeds: [dmEmbed] });
                } catch (error) {
                    message.reply('Not: Kullanıcıya DM gönderilemedi.');
                }

                // Uyarı sayısını kontrol et
                const warnings = await getWarnings(message.guild.id, target.id);
                console.log(`${target.tag} kullanıcısının uyarı sayısı: ${warnings}`);

                // Kick limiti kontrolü
                if (warnings >= settings?.moderation?.warningLimits?.kick) {
                    try {
                        const member = await message.guild.members.fetch(target.id);
                        await member.kick('Uyarı limiti aşıldı');
                        message.channel.send(`🔨 ${target.tag} uyarı limiti (${settings.moderation.warningLimits.kick}) aşıldığı için sunucudan atıldı!`);
                    } catch (error) {
                        console.error('Kick hatası:', error);
                    }
                }

                // Ban limiti kontrolü
                if (warnings >= settings?.moderation?.warningLimits?.ban) {
                    try {
                        const member = await message.guild.members.fetch(target.id);
                        await member.ban({ reason: 'Uyarı limiti aşıldı' });
                        message.channel.send(`🔨 ${target.tag} uyarı limiti (${settings.moderation.warningLimits.ban}) aşıldığı için sunucudan yasaklandı!`);
                    } catch (error) {
                        console.error('Ban hatası:', error);
                    }
                }
            } catch (error) {
                console.error('Uyarı işlemi hatası:', error);
                message.reply('❌ Uyarı gönderilirken bir hata oluştu!');
            }
        } catch (error) {
            console.error('Warn komutu hatası:', error);
            message.reply('❌ Bir hata oluştu!');
        }
    }
};

// Uyarı sayısını getir
async function getWarnings(guildId, userId) {
    try {
        const warnings = await Warning.find({ guildId, userId });
        return warnings.length;
    } catch (error) {
        console.error('Uyarı sayısı alma hatası:', error);
        return 0;
    }
} 