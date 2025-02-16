const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } = require('@discordjs/voice');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const { queueManager } = require(require('path').join(__dirname, '../../utils/QueueManager'));
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// yt-dlp ve ffmpeg yolları
const YT_DLP_PATH = 'C:\\Users\\cebec\\AppData\\Local\\Microsoft\\WinGet\\Links\\yt-dlp.exe';
const FFMPEG_PATH = 'D:\\ffmpeg\\bin\\ffmpeg.exe';

// FFmpeg ayarları
const FFMPEG_OPTIONS = [
    '-i', 'pipe:0',
    '-f', 's16le',
    '-ar', '48000',         // Discord'un standart sample rate'i
    '-ac', '2',             // Stereo ses
    '-b:a', '128k',         // Bit rate arttırıldı (64k -> 128k)
    '-acodec', 'pcm_s16le', // PCM codec
    '-af', 'volume=0.8,bass=gain=3,treble=gain=2', // Ses efektleri
    '-compression_level', '10', // En yüksek kalite
    '-application', 'audio', // Müzik modu
    '-frame_duration', '20', // Daha kısa frame süresi
    '-loglevel', 'error',   
    'pipe:1'
];

// yt-dlp ayarları
const YTDLP_OPTIONS = [
    '-f', 'bestaudio/best', // En iyi ses kalitesi
    '--audio-quality', '0', // En yüksek ses kalitesi
    '--extract-audio',
    '--audio-format', 'wav', // WAV formatı
    '--no-playlist',
    '--no-warnings',
    '--no-part',
    '--no-cache-dir',
    '--progress',
    '--quiet',
    '-o', '-'
];

// Yeni şarkı çalma fonksiyonu
async function startPlaying(url, message, queue, loadingMsg = null) {
    try {
        // Process'leri oluştur
        const ytProcess = spawn(YT_DLP_PATH, [...YTDLP_OPTIONS, url]);
        const ffmpegProcess = spawn(FFMPEG_PATH, FFMPEG_OPTIONS);

        // Stream'leri bağla
        const bufferStream = new PassThrough({
            highWaterMark: 1024 * 512 // 512KB buffer
        });

        // Stream hata yönetimi
        ytProcess.stdout.on('error', () => {});
        ffmpegProcess.stdin.on('error', () => {});
        ffmpegProcess.stdout.on('error', () => {});
        bufferStream.on('error', () => {});

        // Pipe işlemleri
        ytProcess.stdout.pipe(ffmpegProcess.stdin, { end: false });
        ffmpegProcess.stdout.pipe(bufferStream, { end: false });

        // Resource oluştur
        const resource = createAudioResource(bufferStream, {
            inputType: 'raw',
            inlineVolume: true,
            silencePaddingFrames: 0
        });
        resource.volume?.setVolume(0.5);

        // Video başlığını al
        const { stdout: videoTitle } = await execAsync(`"${YT_DLP_PATH}" --get-title --no-playlist "${url}"`);
        const title = videoTitle.trim();

        // Şarkı bilgilerini güncelle
        queue.currentSong = {
            title,
            url,
            requestedBy: message.author.tag
        };

        // Çalmaya başla
        queue.player.play(resource);
        
        // Process temizleme
        ytProcess.on('close', () => {
            ffmpegProcess.stdin.end();
        });

        ffmpegProcess.on('close', () => {
            bufferStream.end();
        });

        // Hata yönetimi
        ytProcess.on('error', (error) => {
            console.error('yt-dlp hatası:', error);
            cleanup();
        });

        ffmpegProcess.on('error', (error) => {
            console.error('ffmpeg hatası:', error);
            cleanup();
        });

        return { ytProcess, ffmpegProcess, title };
    } catch (error) {
        console.error('Şarkı başlatma hatası:', error);
        message.channel.send('❌ Şarkı başlatılırken bir hata oluştu!');
        queue.playing = false;
        queue.currentSong = null;
        return null;
    }
}

module.exports = {
    name: 'play',
    category: 'muzik',
    description: 'Müzik çalar',
    usage: 'play <youtube-linki>',
    run: async (client, message, args) => {
        let connection = null;
        let ytProcess = null;
        let ffmpegProcess = null;
        let isDestroyed = false;

        try {
            // Ses kanalı kontrolü
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                return message.reply('❌ Lütfen önce bir ses kanalına katılın!');
            }

            // Link kontrolü
            if (!args[0]) {
                return message.reply('❌ Bir YouTube linki belirtmelisin!\nÖrnek: !play https://www.youtube.com/watch?v=...');
            }

            const url = args[0];
            const loadingMsg = await message.reply('🎵 Müzik yükleniyor...');

            // Kuyruk oluştur veya al
            const queue = queueManager.get(message.guild.id);

            // Kuyruk limiti kontrolü
            if (queue.songs.length >= queueManager.MAX_QUEUE_SIZE) {
                return message.reply('❌ Kuyruk limiti aşıldı!');
            }

            // Otomatik temizleme başlat
            queueManager.startCleanupTimeout(message.guild.id);

            try {
                // Ses kanalına bağlan
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                // Player oluştur (eğer yoksa)
                if (!queue.player) {
                    queue.player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Play
                        }
                    });

                    // Player'ı bağla
                    connection.subscribe(queue.player);
                    queue.connection = connection;

                    // Player durumlarını dinle
                    queue.player.on(AudioPlayerStatus.Idle, async () => {
                        console.log('Müzik bitti');
                        if (!isDestroyed) {
                            if (queue.songs.length > 0) {
                                const nextSong = queue.songs.shift();
                                console.log('Sıradaki şarkı:', nextSong.title);
                                const result = await startPlaying(nextSong.url, message, queue);
                                if (result) {
                                    ytProcess = result.ytProcess;
                                    ffmpegProcess = result.ffmpegProcess;
                                    message.channel.send(`🎵 Şimdi çalınıyor: ${nextSong.title}`);
                                }
                            } else {
                                message.channel.send('🎵 Müzik bitti!');
                                queue.playing = false;
                                queue.currentSong = null;
                                queueManager.remove(message.guild.id);
                                cleanup();
                            }
                        }
                    });
                }

                // Video başlığını al
                const { stdout: videoTitle } = await execAsync(`"${YT_DLP_PATH}" --get-title --no-playlist "${url}"`);
                const title = videoTitle.trim();

                // Şarkı bilgisi
                const songInfo = {
                    title: title,
                    url: url,
                    requestedBy: message.author.tag
                };

                // Zaten müzik çalıyorsa kuyruğa ekle
                if (queue.playing) {
                    queue.songs.push(songInfo);
                    loadingMsg.edit(`✅ **${title}** kuyruğa eklendi! (Sıra: ${queue.songs.length})`);
                    return;
                }

                // İlk şarkıyı çal
                const result = await startPlaying(url, message, queue);
                if (result) {
                    ytProcess = result.ytProcess;
                    ffmpegProcess = result.ffmpegProcess;
                    queue.playing = true;
                    queue.currentSong = songInfo;
                    loadingMsg.edit(`🎵 Şimdi çalınıyor: ${title}`);
                }

            } catch (error) {
                console.error('Stream hatası:', error);
                if (!isDestroyed) {
                    loadingMsg.edit('❌ Bu video oynatılamıyor!');
                    cleanup();
                }
            }

        } catch (error) {
            console.error('Genel hata:', error);
            if (!isDestroyed) {
                message.reply('❌ Bir hata oluştu!');
                cleanup();
            }
        }

        // Temizleme fonksiyonunu güncelle
        function cleanup() {
            isDestroyed = true;

            if (connection && !connection.state.status === 'destroyed') {
                try {
                    connection.destroy();
                } catch (error) {
                    console.error('Bağlantı kapatma hatası:', error);
                }
            }
            
            if (ytProcess) {
                try {
                    ytProcess.stdout.unpipe();
                    ytProcess.kill('SIGKILL');
                } catch (error) {
                    console.error('yt-dlp kapatma hatası:', error);
                }
            }
            
            if (ffmpegProcess) {
                try {
                    ffmpegProcess.stdin.end();
                    ffmpegProcess.stdout.unpipe();
                    ffmpegProcess.kill('SIGKILL');
                } catch (error) {
                    console.error('ffmpeg kapatma hatası:', error);
                }
            }

            // Tüm referansları temizle
            ytProcess = null;
            ffmpegProcess = null;
            connection = null;
        }

        // Process'leri temizle
        process.on('exit', () => {
            if (!isDestroyed) cleanup();
        });
    }
};