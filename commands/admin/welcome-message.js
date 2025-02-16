module.exports = {
    name: 'welcome-message',
    category: 'admin',
    description: 'Karşılama mesajını özelleştirir',
    usage: 'welcome-message <mesaj>',
    permission: 'ADMINISTRATOR',
    run: async (client, message, args) => {
        const welcomeMessage = args.join(' ');
        if (!welcomeMessage) return message.reply('❌ Bir mesaj yazmalısın!');
        
        await client.updateServerSettings(message.guild.id, {
            'welcomeMessage': welcomeMessage
        });
        
        message.reply('✅ Karşılama mesajı güncellendi!');
    }
}; 