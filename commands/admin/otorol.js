module.exports = {
    name: 'otorol',
    category: 'admin',
    description: 'Yeni üyelere otomatik rol verir',
    usage: 'otorol @rol',
    permission: 'ADMINISTRATOR',
    run: async (client, message, args) => {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ Bir rol etiketlemelisin!');
        
        await client.updateServerSettings(message.guild.id, {
            'autoRole.enabled': true,
            'autoRole.roleId': role.id
        });
        
        message.reply(`✅ Otomatik rol ${role} olarak ayarlandı!`);
    }
}; 