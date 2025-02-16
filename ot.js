// Web sunucusu ve bot başlatma
const PORT = process.env.PORT || 3001; // 3000 yerine 3001 kullan
app.listen(PORT, () => {
    console.log(`Web sunucusu başlatıldı: http://localhost:${PORT}`);
}); 

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB Atlas bağlantısı başarılı');
        
        // MongoDB bağlantısı başarılı olduktan sonra web sunucusunu başlat
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Web sunucusu başlatıldı: http://localhost:${PORT}`);
        }).on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`${PORT} portu kullanımda, ${PORT + 1} deneniyor...`);
                app.listen(PORT + 1);
            } else {
                console.error('Web sunucusu hatası:', error);
            }
        });
    })
    .catch((err) => {
        console.error('MongoDB Atlas bağlantı hatası:', err);
    });

// Bot'u başlat
client.login(process.env.DISCORD_TOKEN); 