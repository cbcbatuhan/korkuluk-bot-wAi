// Müzik durumunu güncelle
function updateMusicStatus() {
    const guildId = window.location.pathname.split('/')[2]; // URL'den guild ID'yi al
    
    fetch(`/api/music/${guildId}`)
        .then(response => response.json())
        .then(data => {
            const currentSong = document.getElementById('currentSong');
            const queueList = document.getElementById('queueList');
            
            // Şu an çalan şarkıyı güncelle
            if (data.playing && data.currentSong) {
                currentSong.innerHTML = `
                    <div class="playing-song">
                        <div class="song-title">🎵 ${data.currentSong.title}</div>
                        <div class="song-requester">👤 İsteyen: ${data.currentSong.requestedBy}</div>
                    </div>
                `;
            } else {
                currentSong.innerHTML = '<p class="no-music">Müzik çalmıyor</p>';
            }
            
            // Kuyruğu güncelle
            queueList.innerHTML = '';
            if (data.queue.length === 0) {
                queueList.innerHTML = '<li class="no-music">Kuyrukta şarkı yok</li>';
            } else {
                data.queue.forEach((song, index) => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="song-info">
                            <span class="song-number">${index + 1}.</span>
                            <span class="song-title">${song.title}</span>
                        </div>
                        <span class="song-requester">👤 ${song.requestedBy}</span>
                    `;
                    queueList.appendChild(li);
                });
            }
        })
        .catch(error => {
            console.error('Müzik durumu alınamadı:', error);
        });
}

// Müzik kontrolü
function controlMusic(action) {
    const guildId = window.location.pathname.split('/')[2];
    
    fetch(`/api/music/${guildId}/${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Boş bir body ekleyin
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            updateMusicStatus();
            if (data.message) {
                // İsteğe bağlı: Başarı mesajını göster
                console.log(data.message);
            }
        } else {
            alert(data.error || 'Bir hata oluştu');
        }
    })
    .catch(error => {
        console.error('Müzik kontrolü hatası:', error);
        alert('İşlem gerçekleştirilemedi');
    });
}

// Uyarı yönetimi fonksiyonları
async function loadWarnings() {
    try {
        const guildId = window.location.pathname.split('/')[2];
        console.log('Uyarılar yükleniyor...', { guildId });

        const response = await fetch(`/api/warnings/${guildId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });

        console.log('API Yanıtı:', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type')
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Veri:', data);

        const tableBody = document.getElementById('warningTableBody');
        
        if (data.warnings.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center;">
                        Henüz uyarı bulunmuyor
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        
        data.warnings.forEach(warning => {
            const row = document.createElement('tr');
            
            // Uyarı sayısına göre renk sınıfı
            let countClass = 'low';
            if (warning.count >= 3) countClass = 'medium';
            if (warning.count >= 5) countClass = 'high';
            
            row.innerHTML = `
                <td>
                    <div class="user-info">
                        <img src="${warning.avatar}" class="user-avatar small" alt="${warning.username}">
                        <span>${warning.username}</span>
                    </div>
                </td>
                <td>
                    <span class="warning-count ${countClass}">${warning.count}</span>
                </td>
                <td>${new Date(warning.lastWarning).toLocaleString('tr-TR')}</td>
                <td>
                    <div class="warning-actions">
                        <button onclick="resetWarnings('${warning.userId}')" class="warning-btn reset">
                            Sıfırla
                        </button>
                        <button onclick="removeLastWarning('${warning.userId}')" class="warning-btn remove">
                            Son Uyarıyı Kaldır
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Uyarı yükleme hatası:', {
            message: error.message,
            stack: error.stack
        });

        const tableBody = document.getElementById('warningTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--danger-color);">
                        Hata: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
}

async function resetWarnings(userId) {
    const guildId = window.location.pathname.split('/')[2];
    try {
        const response = await fetch(`/api/warnings/${guildId}/${userId}/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            loadWarnings();
        } else {
            alert('Uyarılar sıfırlanırken bir hata oluştu!');
        }
    } catch (error) {
        console.error('Uyarı sıfırlama hatası:', error);
    }
}

async function removeLastWarning(userId) {
    const guildId = window.location.pathname.split('/')[2];
    try {
        const response = await fetch(`/api/warnings/${guildId}/${userId}/remove-last`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            loadWarnings();
        } else {
            alert('Son uyarı kaldırılırken bir hata oluştu!');
        }
    } catch (error) {
        console.error('Uyarı kaldırma hatası:', error);
    }
}

// Arama fonksiyonu
document.getElementById('warningSearch').addEventListener('input', function(e) {
    const searchText = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#warningTableBody tr');
    
    rows.forEach(row => {
        const username = row.querySelector('.user-info span').textContent.toLowerCase();
        row.style.display = username.includes(searchText) ? '' : 'none';
    });
});

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Müzik durumunu güncelle
        updateMusicStatus();
        setInterval(updateMusicStatus, 3000);

        // Uyarıları yükle
        await loadWarnings();
        console.log('Uyarılar yüklendi'); // Debug log

        // Arama kutusuna event listener ekle
        const searchInput = document.getElementById('warningSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                const searchText = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#warningTableBody tr');
                
                rows.forEach(row => {
                    const username = row.querySelector('.user-info span').textContent.toLowerCase();
                    row.style.display = username.includes(searchText) ? '' : 'none';
                });
            });
        }
    } catch (error) {
        console.error('Sayfa yüklenirken hata:', error);
    }
}); 