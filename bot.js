require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const app = express();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Guild = require('./models/Guild');
const QueueManager = require('./utils/QueueManager');
const queueManager = QueueManager.queueManager;
const Warning = require('./models/Warning');

// Discord bot ayarları
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Express ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());

// Passport ayarları
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Discord Strategy'sini yapılandır
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/discord/callback',
    scope: ['identify', 'guilds']
}, function(accessToken, refreshToken, profile, done) {
    // Kullanıcı bilgilerini döndür
    process.nextTick(function() {
        return done(null, profile);
    });
}));

// Session ayarları
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // HTTP için false, HTTPS için true
        maxAge: 24 * 60 * 60 * 1000 // 24 saat
    }
}));

// Passport middleware'lerini ekle
app.use(passport.initialize());
app.use(passport.session());

// API Router'ı oluştur
const apiRouter = express.Router();

// API Authentication Middleware
const apiAuth = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        console.log('API Auth Hatası:', {
            session: req.session,
            user: req.user,
            isAuthenticated: req.isAuthenticated()
        });
        return res.status(401).json({
            success: false,
            error: 'Oturum açmanız gerekiyor'
        });
    }
    next();
};

// API endpoint'leri
apiRouter.get('/warnings/:guildId', apiAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        console.log('API İsteği:', {
            guildId,
            userId: req.user?.id,
            path: req.path,
            method: req.method,
            headers: req.headers
        });

        // Sunucu kontrolü
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.status(404).json({
                success: false,
                error: 'Sunucu bulunamadı'
            });
        }

        // Yetki kontrolü
        const member = guild.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.status(403).json({
                success: false,
                error: 'Bu işlem için yetkiniz yok'
            });
        }

        // Uyarıları getir
        const warnings = await Warning.find({ guildId }).sort({ timestamp: -1 });
        console.log(`${warnings.length} uyarı bulundu`);

        // Kullanıcı bazında grupla
        const warningGroups = {};
        warnings.forEach(warning => {
            if (!warningGroups[warning.userId]) {
                warningGroups[warning.userId] = {
                    count: 0,
                    lastWarning: warning.timestamp
                };
            }
            warningGroups[warning.userId].count++;
        });

        // Kullanıcı bilgilerini ekle
        const warningsWithUserInfo = await Promise.all(
            Object.entries(warningGroups).map(async ([userId, data]) => {
                try {
                    const user = await client.users.fetch(userId);
                    return {
                        userId,
                        username: user.tag,
                        avatar: user.displayAvatarURL({ dynamic: true, size: 32 }),
                        count: data.count,
                        lastWarning: data.lastWarning
                    };
                } catch (error) {
                    return {
                        userId,
                        username: 'Bilinmeyen Kullanıcı #' + userId.slice(-4),
                        avatar: '/img/default-avatar.png',
                        count: data.count,
                        lastWarning: data.lastWarning
                    };
                }
            })
        );

        // Yanıtı gönder
        res.setHeader('Content-Type', 'application/json');
        res.json({
            success: true,
            warnings: warningsWithUserInfo
        });

    } catch (error) {
        console.error('API Hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Sunucu hatası',
            message: error.message
        });
    }
});

apiRouter.post('/warnings/:guildId/:userId/reset', apiAuth, async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        await Warning.deleteMany({ guildId, userId });
        res.json({ success: true });
    } catch (error) {
        console.error('Uyarı sıfırlama hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Sunucu hatası' 
        });
    }
});

apiRouter.post('/warnings/:guildId/:userId/remove-last', apiAuth, async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const lastWarning = await Warning.findOne(
            { guildId, userId },
            {},
            { sort: { timestamp: -1 }}
        );
        
        if (lastWarning) {
            await lastWarning.deleteOne();
            res.json({ success: true });
        } else {
            res.status(404).json({ 
                success: false, 
                error: 'Uyarı bulunamadı' 
            });
        }
    } catch (error) {
        console.error('Son uyarı kaldırma hatası:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Sunucu hatası' 
        });
    }
});

// API Router'ı uygula - TÜM ROTALARDAN ÖNCE olmalı
app.use('/api', apiRouter);

// Middleware - Giriş kontrolü
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Giriş sayfası
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/dashboard');
    }
    res.render('login');
});

// Discord ile giriş
app.get('/auth/discord', passport.authenticate('discord'));

// Discord callback
app.get('/auth/discord/callback', 
    passport.authenticate('discord', {
        failureRedirect: '/login'
    }), 
    function(req, res) {
        res.redirect('/dashboard');
    }
);

// Çıkış
app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Konfigürasyon dosyası işlemleri
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Konfigürasyonu yükle
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Konfig dosyası yüklenirken hata:', error);
    }
    return {
        welcomeChannels: {},
        goodbyeChannels: {}
    };
}

// Konfigürasyonu kaydet
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4));
    } catch (error) {
        console.error('Konfig dosyası kaydedilirken hata:', error);
    }
}

// Global değişkenler yerine config kullan
const config = loadConfig();

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI, {
    // Deprecated opsiyonları kaldırdık
    // useNewUrlParser: true,
    // useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB bağlantısı başarılı');
}).catch((err) => {
    console.error('MongoDB bağlantı hatası:', err);
});

// Ana sayfa rotası
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        // Kullanıcının erişebildiği sunucuları al
        const guilds = req.user.guilds
            .filter(guild => (guild.permissions & 0x20) === 0x20) // ADMINISTRATOR yetkisi olanlar
            .map(guild => ({
                ...guild,
                botAdded: client.guilds.cache.has(guild.id),
                icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null
            }));

        res.render('server-select', {
            user: req.user,
            guilds
        });
    } else {
        res.redirect('/login');
    }
});

// Dashboard rotası
app.get('/dashboard', isAuthenticated, (req, res) => {
    // Kullanıcının erişebildiği sunucuları al
    const guilds = req.user.guilds
        .filter(guild => (guild.permissions & 0x20) === 0x20)
        .map(guild => ({
            ...guild,
            botAdded: client.guilds.cache.has(guild.id),
            icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null
        }));

    res.render('server-select', {
        user: req.user,
        guilds
    });
});

// Sunucu dashboard rotası
app.get('/dashboard/:guildId', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { error, success } = req.query;

        // Sunucuyu kontrol et
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return res.redirect('/dashboard');
        }

        // Yetki kontrolü
        const member = guild.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.redirect('/dashboard');
        }

        // Sunucu ayarlarını getir
        const settings = await getServerSettings(guildId);
        
        // Debug için loglar
        console.log('Dashboard Render:', {
            guildId,
            welcomeChannel: settings.welcomeChannelId,
            goodbyeChannel: settings.goodbyeChannelId
        });

        // Kanalları getir
        const channels = guild.channels.cache
            .filter(channel => channel.type === 0)
            .map(channel => ({
                id: channel.id,
                name: channel.name
            }));

        // Rolleri getir
        const roles = guild.roles.cache
            .filter(role => role.id !== guild.id)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.hexColor
            }))
            .sort((a, b) => b.position - a.position);

        res.render('dashboard', {
            user: req.user,
            guild,
            settings,
            channels,
            roles,
            error,
            success,
            req
        });
    } catch (error) {
        console.error('Dashboard hatası:', error);
        res.redirect('/dashboard');
    }
});

// Mesaj gönderme endpoint'i
app.post('/send-message', isAuthenticated, (req, res) => {
    const { channelId, message } = req.body;
    const channel = client.channels.cache.get(channelId);
    
    // Kanal kontrolü ve yetki kontrolü
    if (channel && channel.guild.members.cache.get(req.user.id)?.permissions.has('Administrator')) {
        channel.send(message);
        res.redirect('/');
    } else {
        res.status(403).send('Yetkiniz yok');
    }
});

// Kanal ayarları için endpoint
app.post('/set-channels', isAuthenticated, async (req, res) => {
    const { welcome, goodbye, guildId } = req.body;
    
    try {
        // Yetki kontrolü
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.status(403).json({ 
                success: false, 
                error: 'Bu işlem için yetkiniz yok' 
            });
        }

        // Kanalların geçerliliğini kontrol et
        const welcomeChannel = welcome ? guild.channels.cache.get(welcome) : null;
        const goodbyeChannel = goodbye ? guild.channels.cache.get(goodbye) : null;

        if (welcome && !welcomeChannel) {
            return res.redirect(`/dashboard/${guildId}?error=Seçilen karşılama kanalı bulunamadı`);
        }

        if (goodbye && !goodbyeChannel) {
            return res.redirect(`/dashboard/${guildId}?error=Seçilen uğurlama kanalı bulunamadı`);
        }

        // Ayarları kaydet
        const updatedSettings = await Guild.findOneAndUpdate(
            { guildId },
            {
                welcomeChannelId: welcome || null,
                goodbyeChannelId: goodbye || null
            },
            { 
                upsert: true,
                new: true // Güncellenmiş dokümanı döndür
            }
        );

        console.log('Kanal ayarları güncellendi:', {
            guildId,
            welcomeChannel: updatedSettings.welcomeChannelId,
            goodbyeChannel: updatedSettings.goodbyeChannelId
        });
        
        // Başarılı mesajıyla birlikte dashboard'a yönlendir
        res.redirect(`/dashboard/${guildId}?success=Karşılama ayarları güncellendi`);

    } catch (error) {
        console.error('Kanal ayarları hatası:', error);
        // Hata mesajıyla birlikte dashboard'a yönlendir
        res.redirect(`/dashboard/${guildId}?error=Ayarlar kaydedilirken bir hata oluştu`);
    }
});

// Sunucu ayarları sayfası
app.get('/server/:guildId/settings', isAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    
    // Yetki kontrolü
    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(req.user.id);
    if (!member?.permissions.has('ADMINISTRATOR')) {
        return res.status(403).send('Yetkiniz yok');
    }

    const serverSettings = await getServerSettings(guildId);
    const channels = guild.channels.cache
        .filter(channel => channel.type === 0)
        .map(channel => ({
            id: channel.id,
            name: channel.name
        }));
    
    const roles = guild.roles.cache
        .map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor
        }));

    res.render('dashboard', {
        guild,
        settings: serverSettings,
        channels,
        roles,
        user: req.user
    });
});

// Ayarları kaydetme
app.post('/server/:guildId/settings', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { prefix } = req.body;

        // Yetki kontrolü
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.redirect(`/dashboard/${guildId}?error=Bu işlem için yetkiniz yok`);
        }

        // Ayarları güncelle
        await Guild.findOneAndUpdate(
            { guildId },
            { 
                $set: { prefix: prefix || '!' }
            },
            { upsert: true }
        );

        res.redirect(`/dashboard/${guildId}?success=Bot ayarları güncellendi`);
    } catch (error) {
        console.error('Bot ayarları hatası:', error);
        res.redirect(`/dashboard/${guildId}?error=Ayarlar kaydedilirken bir hata oluştu`);
    }
});

// Moderasyon ayarları
app.post('/server/:guildId/settings/moderation', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            modLogChannel,
            enableKick,
            enableBan,
            enableWarn,
            enableMute,
            enableUnban,
            enableAutoMod,
            enableSpamProtection,
            enableSwearFilter,
            warnKickLimit,
            warnBanLimit
        } = req.body;

        console.log('Gelen moderasyon ayarları:', req.body); // Debug için

        // Yetki kontrolü
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.redirect(`/dashboard/${guildId}?error=Bu işlem için yetkiniz yok`);
        }

        // Ayarları güncelle
        const updatedSettings = await Guild.findOneAndUpdate(
            { guildId },
            {
                $set: {
                    'moderation.logChannel': modLogChannel || null,
                    'moderation.enableKick': enableKick === 'on',
                    'moderation.enableBan': enableBan === 'on',
                    'moderation.enableWarn': enableWarn === 'on',
                    'moderation.enableMute': enableMute === 'on',
                    'moderation.enableUnban': enableUnban === 'on',
                    'moderation.enableAutoMod': enableAutoMod === 'on',
                    'moderation.enableSpamProtection': enableSpamProtection === 'on',
                    'moderation.enableSwearFilter': enableSwearFilter === 'on',
                    'moderation.warningLimits.kick': parseInt(warnKickLimit) || 3,
                    'moderation.warningLimits.ban': parseInt(warnBanLimit) || 5
                }
            },
            { upsert: true, new: true }
        );

        console.log('Güncellenen ayarlar:', updatedSettings); // Debug için

        // Başarılı mesajıyla yönlendir
        res.redirect(`/dashboard/${guildId}?success=Moderasyon ayarları güncellendi`);

    } catch (error) {
        console.error('Moderasyon ayarları hatası:', error);
        res.redirect(`/dashboard/${guildId}?error=Ayarlar kaydedilirken bir hata oluştu`);
    }
});

// Otomatik rol ayarları
app.post('/server/:guildId/settings/autorole', isAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { enabled, roleId } = req.body;

    await updateServerSettings(guildId, {
        'autoRole.enabled': enabled === 'on',
        'autoRole.roleId': roleId
    });

    res.redirect(`/dashboard/${guildId}`);
});

// Seviye sistemi ayarları
app.post('/server/:guildId/settings/leveling', isAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { enabled, levelChannel } = req.body;

    await updateServerSettings(guildId, {
        'leveling.enabled': enabled === 'on',
        'leveling.channelId': levelChannel
    });

    res.redirect(`/dashboard/${guildId}`);
});

// Çekiliş ayarları
app.post('/server/:guildId/settings/giveaway', isAuthenticated, async (req, res) => {
    const { guildId } = req.params;
    const { giveawayChannel } = req.body;

    await updateServerSettings(guildId, {
        'giveaway.channelId': giveawayChannel
    });

    res.redirect(`/dashboard/${guildId}`);
});

// Komut koleksiyonu
client.commands = new Map();

// Komutları yükle
fs.readdirSync('./commands/').forEach(dir => {
    const commands = fs.readdirSync(`./commands/${dir}/`).filter(file => file.endsWith('.js'));
    
    for (const file of commands) {
        const command = require(`./commands/${dir}/${file}`);
        console.log(`Yüklenen komut: ${file} - ${command?.name || 'undefined'}`); // Log ekledik
        
        if (command.name) {
            client.commands.set(command.name, command);
        } else {
            console.error(`Hata: ${file} dosyasında name özelliği bulunamadı!`);
        }
    }
});

// Bot hazır olduğunda
client.once('ready', () => {
    console.log(`Bot olarak giriş yapıldı: ${client.user.tag}`);
});

// Mesaj olayını güncelle
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Sunucu ayarlarını al
    const settings = await getServerSettings(message.guild.id);
    
    // Prefix kontrolü
    if (!message.content.startsWith(settings.prefix)) return;

    const args = message.content.slice(settings.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    // Yetki kontrolü
    if (command.permission && !message.member.permissions.has(command.permission)) {
        return message.reply('❌ Bu komutu kullanmak için yetkiniz yok!');
    }

    try {
        await command.run(client, message, args, settings);
    } catch (error) {
        console.error(error);
        message.reply('❌ Komut çalıştırılırken bir hata oluştu!');
    }
});

// Karşılama olayı
client.on('guildMemberAdd', async member => {
    const guildSettings = await Guild.findOne({ guildId: member.guild.id });
    if (!guildSettings?.welcomeChannelId) return;
    
    const channel = client.channels.cache.get(guildSettings.welcomeChannelId);
    if (!channel) return;

    const welcomeEmbed = {
        color: 0x00ff00,
        title: '🎉 Yeni Üye!',
        description: `Hoş geldin ${member}! **${member.guild.name}** sunucusuna katıldın!\n\nSeninle birlikte ${member.guild.memberCount} kişi olduk!`,
        thumbnail: {
            url: member.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: new Date()
    };

    await channel.send({ embeds: [welcomeEmbed] });
});

// Uğurlama olayı
client.on('guildMemberRemove', async member => {
    const guildSettings = await Guild.findOne({ guildId: member.guild.id });
    if (!guildSettings?.goodbyeChannelId) return;
    
    const channel = client.channels.cache.get(guildSettings.goodbyeChannelId);
    if (!channel) return;

    const goodbyeEmbed = {
        color: 0xff0000,
        title: '👋 Görüşürüz!',
        description: `${member.user.tag} sunucudan ayrıldı.\n\nArtık ${member.guild.memberCount} kişiyiz.`,
        thumbnail: {
            url: member.user.displayAvatarURL({ dynamic: true })
        },
        timestamp: new Date()
    };

    await channel.send({ embeds: [goodbyeEmbed] });
});

// Sunucu ayarlarını getirme fonksiyonunu güncelle
async function getServerSettings(guildId) {
    try {
        let guild = await Guild.findOne({ guildId });
        if (!guild) {
            guild = await Guild.create({
                guildId,
                prefix: '!',
                welcomeChannelId: null,
                goodbyeChannelId: null,
                moderation: {
                    logChannel: null,
                    enableKick: false,
                    enableBan: false,
                    enableWarn: false,
                    enableMute: false,
                    enableUnban: false,
                    enableAutoMod: false,
                    enableSpamProtection: false,
                    enableSwearFilter: false,
                    warningLimits: {
                        kick: 3,
                        ban: 5
                    }
                },
                autoRole: {
                    enabled: false,
                    roleId: null
                }
            });
        }
        return guild;
    } catch (error) {
        console.error('Sunucu ayarları getirme hatası:', error);
        return null;
    }
}

// Sunucu ayarlarını güncelleme fonksiyonunu güncelle
async function updateServerSettings(guildId, settings) {
    try {
        const guild = await Guild.findOneAndUpdate(
            { guildId },
            { $set: settings },
            { new: true, upsert: true }
        );
        return guild;
    } catch (error) {
        console.error('Sunucu ayarları güncelleme hatası:', error);
        return null;
    }
}

// Müzik durumunu alma endpoint'i
app.get('/api/music/:guildId', isAuthenticated, (req, res) => {
    const { guildId } = req.params;
    const queue = queueManager.get(guildId);
    
    if (!queue) {
        return res.json({
            playing: false,
            currentSong: null,
            queue: []
        });
    }

    res.json({
        playing: queue.playing,
        currentSong: queue.currentSong,
        queue: queue.songs
    });
});

// Müzik kontrolü endpoint'leri
app.post('/api/music/:guildId/skip', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const queue = queueManager.get(guildId);
        
        if (!queue?.player) {
            return res.json({ success: false, error: 'Müzik çalmıyor' });
        }

        queue.player.stop();
        res.json({ success: true, message: 'Şarkı geçildi' });
    } catch (error) {
        console.error('Skip hatası:', error);
        res.json({ success: false, error: 'Bir hata oluştu' });
    }
});

app.post('/api/music/:guildId/pause', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const queue = queueManager.get(guildId);
        
        if (!queue?.player) {
            return res.json({ success: false, error: 'Müzik çalmıyor' });
        }

        if (queue.player.state.status === 'playing') {
            queue.player.pause();
            res.json({ success: true, message: 'Müzik duraklatıldı' });
        } else {
            queue.player.unpause();
            res.json({ success: true, message: 'Müzik devam ediyor' });
        }
    } catch (error) {
        console.error('Pause/Resume hatası:', error);
        res.json({ success: false, error: 'Bir hata oluştu' });
    }
});

// Moderasyon log fonksiyonunu güncelle
async function sendModLog(guildId, action, moderator, target, reason) {
    try {
        const settings = await Guild.findOne({ guildId });
        if (!settings?.moderation?.logChannel) return;

        const guild = client.guilds.cache.get(guildId);
        const logChannel = guild.channels.cache.get(settings.moderation.logChannel);
        if (!logChannel) return;

        const colors = {
            KICK: 0xffa500,  // Turuncu
            BAN: 0xff0000,   // Kırmızı
            UNBAN: 0x00ff00, // Yeşil
            WARN: 0xffff00,  // Sarı
            MUTE: 0x808080   // Gri
        };

        const embed = {
            color: colors[action] || 0x0099ff,
            title: `🛡️ ${action}`,
            fields: [
                {
                    name: '👤 Moderatör',
                    value: moderator.tag,
                    inline: true
                },
                {
                    name: '🎯 Hedef Kullanıcı',
                    value: target.tag,
                    inline: true
                },
                {
                    name: '📝 Sebep',
                    value: reason || 'Sebep belirtilmedi'
                }
            ],
            timestamp: new Date()
        };

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Moderasyon log gönderme hatası:', error);
    }
}

// Client'a moderasyon log fonksiyonunu ekle
client.sendModLog = sendModLog;

// Özel komut ekleme
app.post('/server/:guildId/commands/add', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { commandName, commandResponse } = req.body;

        // Yetki kontrolü
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.redirect(`/dashboard/${guildId}?error=Bu işlem için yetkiniz yok`);
        }

        await Guild.findOneAndUpdate(
            { guildId },
            {
                $push: {
                    customCommands: {
                        name: commandName,
                        response: commandResponse,
                        createdBy: req.user.id
                    }
                }
            }
        );

        res.redirect(`/dashboard/${guildId}?success=Özel komut eklendi`);
    } catch (error) {
        console.error('Özel komut ekleme hatası:', error);
        res.redirect(`/dashboard/${guildId}?error=Komut eklenirken bir hata oluştu`);
    }
});

// Susturma ayarları
app.post('/server/:guildId/settings/mute', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { muteRole, defaultDuration, maxDuration } = req.body;

        await Guild.findOneAndUpdate(
            { guildId },
            {
                $set: {
                    'moderation.muteRole': muteRole,
                    'moderation.muteDurations.default': defaultDuration * 3600,
                    'moderation.muteDurations.max': maxDuration * 3600
                }
            }
        );

        res.redirect(`/dashboard/${guildId}?success=Susturma ayarları güncellendi`);
    } catch (error) {
        console.error('Susturma ayarları hatası:', error);
        res.redirect(`/dashboard/${guildId}?error=Ayarlar güncellenirken bir hata oluştu`);
    }
});

// Üye sayacı ayarları
app.post('/server/:guildId/settings/counter', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { memberCountChannel } = req.body;

        await Guild.findOneAndUpdate(
            { guildId },
            {
                $set: {
                    'settings.memberCountChannel': memberCountChannel
                }
            }
        );

        // Kanal adını güncelle
        if (memberCountChannel) {
            const guild = client.guilds.cache.get(guildId);
            const channel = guild.channels.cache.get(memberCountChannel);
            if (channel) {
                await channel.setName(`👥 Üyeler: ${guild.memberCount}`);
            }
        }

        res.redirect(`/dashboard/${guildId}?success=Üye sayacı ayarları güncellendi`);
    } catch (error) {
        console.error('Üye sayacı ayarları hatası:', error);
        res.redirect(`/dashboard/${guildId}?error=Ayarlar güncellenirken bir hata oluştu`);
    }
});

// Susturma rolü oluşturma endpoint'i
app.post('/server/:guildId/settings/mute/create-role', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;

        // Yetki kontrolü
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(req.user.id);
        if (!member?.permissions.has('ADMINISTRATOR')) {
            return res.status(403).json({
                success: false,
                error: 'Bu işlem için yetkiniz yok'
            });
        }

        // Mevcut ayarları kontrol et
        const settings = await Guild.findOne({ guildId });
        
        // Eğer zaten bir mute rolü varsa ve rol hala sunucuda mevcutsa
        if (settings?.moderation?.muteRole) {
            const existingRole = guild.roles.cache.get(settings.moderation.muteRole);
            if (existingRole) {
                return res.status(400).json({
                    success: false,
                    error: 'Bu sunucuda zaten bir susturma rolü mevcut',
                    roleId: existingRole.id,
                    roleName: existingRole.name
                });
            }
        }

        // Ayrıca "Muted" isimli bir rol var mı diye kontrol et
        const existingMutedRole = guild.roles.cache.find(role => role.name === 'Muted');
        if (existingMutedRole) {
            // Varolan rolü veritabanına kaydet
            await Guild.findOneAndUpdate(
                { guildId },
                { 'moderation.muteRole': existingMutedRole.id },
                { new: true }
            );

            return res.status(400).json({
                success: false,
                error: 'Bu sunucuda zaten "Muted" rolü mevcut',
                roleId: existingMutedRole.id,
                roleName: existingMutedRole.name
            });
        }

        // Yeni rol oluştur
        const muteRole = await guild.roles.create({
            name: 'Muted',
            color: '#666666',
            reason: 'Susturma rolü',
            permissions: []
        });

        // Tüm kanallarda susturma rolünün yetkilerini ayarla
        await Promise.all(guild.channels.cache.map(channel => 
            channel.permissionOverwrites.create(muteRole, {
                SendMessages: false,
                AddReactions: false,
                Speak: false,
                Stream: false,
            })
        ));

        // Rolü veritabanına kaydet
        await Guild.findOneAndUpdate(
            { guildId },
            { 'moderation.muteRole': muteRole.id },
            { new: true }
        );

        res.json({
            success: true,
            roleId: muteRole.id,
            roleName: muteRole.name
        });

    } catch (error) {
        console.error('Susturma rolü oluşturma hatası:', error);
        res.status(500).json({
            success: false,
            error: 'Rol oluşturulurken bir hata oluştu'
        });
    }
});

// Normal web rotaları buradan sonra gelmeli
// ... diğer rotalar ...

// Web sunucusu ve bot başlatma
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web sunucusu başlatıldı: http://localhost:${PORT}`);
});

client.login(process.env.DISCORD_TOKEN); 