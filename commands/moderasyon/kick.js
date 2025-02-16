module.exports = {
    name: 'kick',
    category: 'moderasyon',
    description: 'Kullanıcıyı sunucudan atar',
    permission: 'KICK_MEMBERS',
    usage: 'kick <@kullanıcı> [sebep]',
    run: async (client, message, args, settings) => {
        // Yetki kontrolü
        if (!settings.moderation?.enableKick) {
            return message.reply('❌ Kick komutu bu sunucuda devre dışı!');
        }

        if (!message.member.permissions.has('KICK_MEMBERS')) {
            return message.reply('❌ Bu komutu kullanmak için yetkiniz yok!');
        }

        // Hedef kullanıcı kontrolü
        const target = message.mentions.members.first();
        if (!target) {
            return message.reply('❌ Lütfen bir kullanıcı etiketleyin!');
        }

        // Yetki hiyerarşisi kontrolü
        if (target.roles.highest.position >= message.member.roles.highest.position) {
            return message.reply('❌ Bu kullanıcıyı kickleyemezsiniz!');
        }

        // Sebep
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';

        try {
            await target.kick(reason);
            message.reply(`✅ ${target.user.tag} sunucudan atıldı!`);

            // Moderasyon log gönder
            await client.sendModLog(
                message.guild.id,
                'KICK',
                message.author,
                target.user,
                reason
            );
        } catch (error) {
            console.error('Kick hatası:', error);
            message.reply('❌ Kullanıcı kicklenirken bir hata oluştu!');
        }
    }
}; 