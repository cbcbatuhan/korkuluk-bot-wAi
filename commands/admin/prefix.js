module.exports = {
    name: 'prefix',
    category: 'admin',
    description: 'Bot komut önekini değiştirir',
    usage: 'prefix <yeni-önek>',
    permission: 'ADMINISTRATOR',
    run: async (client, message, args, settings) => {
        if (!args[0]) {
            return message.reply(`Mevcut önek: \`${settings.prefix}\`\nDeğiştirmek için: \`${settings.prefix}prefix <yeni-önek>\``);
        }

        const newPrefix = args[0];
        if (newPrefix.length > 3) {
            return message.reply('Önek en fazla 3 karakter olabilir!');
        }

        await client.updateServerSettings(message.guild.id, { prefix: newPrefix });
        message.reply(`✅ Prefix başarıyla \`${newPrefix}\` olarak güncellendi!`);
    }
}; 