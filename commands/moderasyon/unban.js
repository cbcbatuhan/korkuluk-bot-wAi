module.exports = {
    name: 'unban',
    category: 'moderasyon',
    description: 'Kullanıcının banını kaldırır',
    permission: 'BAN_MEMBERS',
    usage: 'unban <kullanıcı_id> [sebep]',
    run: async (client, message, args, settings) => {
        // Yetki kontrolü
        if (!message.member.permissions.has('BAN_MEMBERS')) {
            return message.reply('❌ Bu komutu kullanmak için yetkiniz yok!');
        }

        // Kullanıcı ID kontrolü
        const userId = args[0];
        if (!userId) {
            return message.reply('❌ Lütfen bir kullanıcı ID\'si girin!');
        }

        // Sebep
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';

        try {
            // Banı kaldır
            await message.guild.members.unban(userId, reason);
            message.reply(`✅ <@${userId}> kullanıcısının banı kaldırıldı!`);

            // Ban bilgilerini al
            const user = await client.users.fetch(userId);

            // Moderasyon log gönder
            await client.sendModLog(
                message.guild.id,
                'UNBAN',
                message.author,
                user,
                reason
            );
        } catch (error) {
            console.error('Unban hatası:', error);
            message.reply('❌ Kullanıcının banı kaldırılırken bir hata oluştu!');
        }
    }
}; 