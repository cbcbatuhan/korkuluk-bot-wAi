module.exports = {
    name: 'ping',
    category: 'genel',
    description: 'Bot gecikmesini gösterir',
    usage: 'ping',
    run: async (client, message, args) => {
        const msg = await message.reply('Ping ölçülüyor...');
        const latency = msg.createdTimestamp - message.createdTimestamp;
        
        msg.edit(`🏓 Pong!\nBot Gecikmesi: \`${latency}ms\`\nAPI Gecikmesi: \`${Math.round(client.ws.ping)}ms\``);
    }
}; 