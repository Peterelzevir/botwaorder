/**
 * Integrasi dengan WhatsApp menggunakan @whiskeysockets/baileys
 * Terintegrasi dengan sistem manajemen error dan logging struktural
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore,
  Browsers,
  delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const config = require('../config');
const { tmpdir } = require('os');

// Store untuk menyimpan semua session WhatsApp
const sessions = {};

// Memastikan direktori sessions ada
function ensureSessionsDirectory() {
  try {
    if (!fs.existsSync(config.SESSIONS_DIR)) {
      fs.mkdirSync(config.SESSIONS_DIR, { recursive: true });
      console.log(`Direktori sesi dibuat: ${config.SESSIONS_DIR}`);
    }
  } catch (error) {
    console.error(`[FATAL] Gagal membuat direktori sesi: ${error.message}`);
    throw new Error(`Gagal membuat direktori sesi: ${error.message}`);
  }
}

// Memastikan direktori session spesifik ada
function ensureSessionDirectory(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('SessionID tidak valid');
  }
  
  try {
    const sessionFolder = path.join(config.SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
    }
    return sessionFolder;
  } catch (error) {
    console.error(`[ERROR] Gagal membuat direktori sesi untuk ${sessionId}: ${error.message}`);
    throw new Error(`Gagal membuat direktori sesi: ${error.message}`);
  }
}

/**
 * Fungsi untuk menghasilkan gambar QR code dan menyimpannya
 * @param {string} qrData - Data QR code yang akan dikonversi menjadi gambar
 * @returns {Promise<string>} - Path ke file gambar QR code
 */
async function generateQRCodeImage(qrData) {
  try {
    // Buat nama file unik dengan timestamp untuk menghindari cache
    const fileName = `qrcode_${Date.now()}.png`;
    const filePath = path.join(tmpdir(), fileName);
    
    // Buat QR code sebagai gambar PNG
    await qrcode.toFile(filePath, qrData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000', // Warna QR (hitam)
        light: '#ffffff' // Warna background (putih)
      }
    });
    
    return filePath;
  } catch (error) {
    console.error('[ERROR] Gagal membuat gambar QR code:', error);
    throw new Error(`Gagal membuat gambar QR code: ${error.message}`);
  }
}

/**
 * Fungsi untuk menginisialisasi koneksi WhatsApp baru
 * @param {string} sessionId - ID unik untuk session WhatsApp
 * @param {function} qrCallback - Callback yang dipanggil ketika QR code siap
 * @param {function} connectionCallback - Callback yang dipanggil ketika status koneksi berubah
 */
async function initializeWhatsApp(sessionId, qrCallback, connectionCallback) {
  if (!sessionId) {
    throw new Error('SessionID tidak dapat kosong');
  }
  
  // Memastikan direktori sessions ada
  ensureSessionsDirectory();
  
  // Membuat folder untuk menyimpan autentikasi
  const sessionFolder = ensureSessionDirectory(sessionId);

  // Menggunakan multi file auth state dengan error handling
  let state, saveCreds;
  try {
    const authResult = await useMultiFileAuthState(sessionFolder);
    state = authResult.state;
    saveCreds = authResult.saveCreds;
  } catch (error) {
    console.error(`[ERROR] Gagal memuat auth state: ${error.message}`);
    throw new Error(`Gagal memuat auth state: ${error.message}`);
  }

  // Mengambil versi terbaru Baileys
  let version, isLatest;
  try {
    const versionInfo = await fetchLatestBaileysVersion();
    version = versionInfo.version;
    isLatest = versionInfo.isLatest;
    console.log(`Menggunakan WA v${version.join('.')}, terbaru: ${isLatest}`);
  } catch (error) {
    console.error(`[ERROR] Gagal mendapatkan versi Baileys: ${error.message}`);
    // Gunakan versi default untuk fallback
    version = [2, 2311, 6];
    console.log(`Menggunakan versi fallback WA v${version.join('.')}`);
  }

  // Store untuk menyimpan pesan
  const store = makeInMemoryStore({});
  const storePath = path.join(sessionFolder, 'store.json');
  
  try {
    if (fs.existsSync(storePath)) {
      store.readFromFile(storePath);
    }
    
    // Set interval untuk menyimpan store secara periodik
    const storeInterval = setInterval(() => {
      try {
        store.writeToFile(storePath);
      } catch (error) {
        console.error(`[ERROR] Gagal menyimpan store: ${error.message}`);
      }
    }, 10000);
    
    // Cleanup interval pada process exit
    process.on('exit', () => {
      clearInterval(storeInterval);
    });
  } catch (error) {
    console.error(`[WARNING] Gagal membaca store: ${error.message}`);
  }

  // Membuat socket WhatsApp dengan mengikuti dokumentasi baileys terbaru
  const sock = makeWASocket({
    version,
    logger: pino({ level: config.LOG_LEVEL }),
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('WhatsApp Manager Bot'),
    // Penting untuk mendukung QR dengan baik
    mobile: false,
    // Tambahan opsi untuk ketahanan
    retryRequestDelayMs: 1000,
    defaultQueryTimeoutMs: 60000, // Meningkatkan timeout untuk permintaan
    qrTimeout: config.QR_TIMEOUT || 60000, // Timeout untuk QR code
    connectTimeoutMs: 60000, // Timeout untuk koneksi
    keepAliveIntervalMs: 25000, // Keep-alive untuk WebSocket
    emitOwnEvents: true, // Menerima events dari diri sendiri
    markOnlineOnConnect: true, // Tandai diri sebagai online
    fireInitQueries: true, // Luncurkan query inisialisasi
    syncFullHistory: false, // Tidak melakukan sinkronisasi penuh untuk performa
    shouldSyncHistoryMessage: false, // Tidak sync history
  });

  // Menyimpan session
  sessions[sessionId] = {
    sock,
    store,
    connected: false,
    createdAt: new Date(),
    lastActive: new Date()
  };

  // Menangani QR code dan koneksi
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Generate QR code sebagai file gambar
      try {
        // 1. Buat gambar QR code terlebih dahulu
        const qrImagePath = await generateQRCodeImage(qr);
        
        // 2. Kirim jalur file gambar ke callback
        qrCallback('image', qrImagePath);
        
        // Simpan salinan ASCII juga untuk fallback atau debug
        const asciiQR = await qrcode.toString(qr, {
          type: 'terminal',
          small: true
        });
        console.log('ASCII QR Code:', asciiQR);
      } catch (error) {
        console.error('[ERROR] Gagal generate QR code:', error);
        // Fallback ke mode teks jika terjadi error
        const textQR = await qrcode.toString(qr, { type: 'utf8' });
        qrCallback('text', textQR);
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`[INFO] Koneksi ditutup dengan status: ${statusCode}`);
      
      if (shouldReconnect) {
        console.log('[INFO] Koneksi ditutup karena ', lastDisconnect?.error, ', menghubungkan kembali...');
        // Set timeout untuk menghindari reconnect loop yang terlalu cepat
        setTimeout(() => {
          try {
            initializeWhatsApp(sessionId, qrCallback, connectionCallback);
          } catch (error) {
            console.error(`[ERROR] Gagal reconnect: ${error.message}`);
            connectionCallback('error', error.message);
          }
        }, config.WA_RECONNECT_INTERVAL);
      } else {
        console.log('[INFO] Koneksi ditutup karena logout');
        delete sessions[sessionId];
        connectionCallback('disconnected');
      }
    } else if (connection === 'open') {
      console.log('[INFO] Koneksi terbuka');
      sessions[sessionId].connected = true;
      sessions[sessionId].lastActive = new Date();
      connectionCallback('connected');
    }
  });

  // Menyimpan kredensial
  sock.ev.on('creds.update', saveCreds);

  // Menyinkronkan pesan dengan store
  store.bind(sock.ev);

  return sock;
}

/**
 * Mendapatkan daftar semua session WhatsApp aktif
 * @returns {Object} - Objek berisi semua session WhatsApp
 */
function getWhatsAppSessions() {
  return sessions;
}

/**
 * Mendapatkan session WhatsApp berdasarkan ID
 * @param {string} sessionId - ID session WhatsApp
 * @returns {Object|null} - Objek session WhatsApp atau null jika tidak ditemukan
 */
function getWhatsAppSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions[sessionId];
  
  if (session) {
    // Update lastActive timestamp
    session.lastActive = new Date();
  }
  
  return session || null;
}

/**
 * Memuat ulang session WhatsApp dari penyimpanan
 * Memastikan semua session yang tersimpan dimuat saat aplikasi dimulai
 */
async function loadSavedSessions() {
  try {
    ensureSessionsDirectory();
    
    const sessionFolders = fs.readdirSync(config.SESSIONS_DIR)
      .filter(file => {
        // Filter hanya direktori yang berisi file auth
        const folderPath = path.join(config.SESSIONS_DIR, file);
        return fs.statSync(folderPath).isDirectory() && 
               fs.existsSync(path.join(folderPath, 'creds.json'));
      });
    
    console.log(`[INFO] Menemukan ${sessionFolders.length} sesi tersimpan`);
    
    // Muat setiap sesi secara berurutan
    for (const sessionId of sessionFolders) {
      try {
        console.log(`[INFO] Mencoba memulihkan sesi: ${sessionId}`);
        
        // Inisialisasi sesi dengan callback minimal
        await initializeWhatsApp(
          sessionId,
          () => {}, // QR callback kosong karena sesi seharusnya sudah terotentikasi
          (status, data) => {
            console.log(`[INFO] Sesi ${sessionId} status: ${status}`);
            if (status === 'error') {
              console.error(`[ERROR] Gagal memulihkan sesi ${sessionId}: ${data}`);
            }
          }
        );
      } catch (error) {
        console.error(`[ERROR] Gagal memulihkan sesi ${sessionId}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('[ERROR] Gagal memuat sesi tersimpan:', error);
  }
}

/**
 * Mendapatkan daftar grup dari session WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @returns {Promise<Array>} - Array berisi daftar grup
 */
async function getWhatsAppGroups(sessionId) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;
  const groups = [];

  try {
    const chats = await sock.groupFetchAllParticipating();
    
    for (const [id, chat] of Object.entries(chats)) {
      groups.push({
        id,
        name: chat.subject || 'Nama Grup Tidak Diketahui',
        participants: Array.isArray(chat.participants) ? chat.participants.map(p => ({
          id: p.id,
          isAdmin: p.admin ? true : false
        })) : []
      });
    }
  } catch (error) {
    console.error('[ERROR] Error saat mengambil grup:', error);
    throw error;
  }

  return groups;
}

/**
 * Mendapatkan link invite grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @returns {Promise<string>} - Link invite grup
 */
async function getGroupInviteLink(sessionId, groupId) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;

  try {
    const link = await sock.groupInviteCode(groupId);
    return `https://chat.whatsapp.com/${link}`;
  } catch (error) {
    console.error('[ERROR] Error saat mengambil link grup:', error);
    throw error;
  }
}

/**
 * Mendapatkan semua link invite grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @returns {Promise<Array>} - Array berisi objek grup dengan link invite
 */
async function getAllGroupInviteLinks(sessionId) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  try {
    const groups = await getWhatsAppGroups(sessionId);
    const result = [];
    
    // Dapatkan link untuk setiap grup dengan penanganan error per grup
    for (const group of groups) {
      try {
        // Tambahkan delay untuk menghindari rate limit
        await delay(300);
        const link = await getGroupInviteLink(sessionId, group.id);
        result.push({
          id: group.id,
          name: group.name,
          link
        });
      } catch (error) {
        console.error(`[ERROR] Gagal mendapatkan link untuk grup ${group.name}: ${error.message}`);
        // Tetap sertakan grup meskipun link gagal diperoleh
        result.push({
          id: group.id,
          name: group.name,
          link: null,
          error: error.message
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('[ERROR] Error saat mengambil semua link grup:', error);
    throw error;
  }
}

/**
 * Mengubah nama grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {string} newName - Nama baru untuk grup
 * @returns {Promise<boolean>} - Status keberhasilan
 */
async function changeGroupName(sessionId, groupId, newName) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;

  try {
    await sock.groupUpdateSubject(groupId, newName);
    return true;
  } catch (error) {
    console.error('[ERROR] Error saat mengubah nama grup:', error);
    throw error;
  }
}

/**
 * Mengubah pengaturan grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {Object} settings - Pengaturan grup
 * @returns {Promise<boolean>} - Status keberhasilan
 */
async function changeGroupSettings(sessionId, groupId, settings) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;

  try {
    if (settings.hasOwnProperty('announce')) {
      await sock.groupSettingUpdate(groupId, settings.announce ? 'announcement' : 'not_announcement');
    }
    
    if (settings.hasOwnProperty('restrict')) {
      await sock.groupSettingUpdate(groupId, settings.restrict ? 'locked' : 'unlocked');
    }
    
    return true;
  } catch (error) {
    console.error('[ERROR] Error saat mengubah pengaturan grup:', error);
    throw error;
  }
}

/**
 * Menambahkan admin grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {string} participantId - ID peserta yang akan dijadikan admin
 * @returns {Promise<boolean>} - Status keberhasilan
 */
async function promoteGroupParticipant(sessionId, groupId, participantId) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;

  try {
    await sock.groupParticipantsUpdate(groupId, [participantId], 'promote');
    return true;
  } catch (error) {
    console.error('[ERROR] Error saat mempromosikan peserta:', error);
    throw error;
  }
}

/**
 * Mengeluarkan peserta dari grup WhatsApp
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {Array} participantIds - Array berisi ID peserta yang akan dikeluarkan
 * @returns {Promise<boolean>} - Status keberhasilan
 */
async function removeGroupParticipants(sessionId, groupId, participantIds) {
  const session = getWhatsAppSession(sessionId);
  if (!session || !session.connected) {
    throw new Error('Session WhatsApp tidak ditemukan atau tidak terhubung');
  }

  const { sock } = session;

  try {
    await sock.groupParticipantsUpdate(groupId, participantIds, 'remove');
    return true;
  } catch (error) {
    console.error('[ERROR] Error saat mengeluarkan peserta:', error);
    throw error;
  }
}

/**
 * Membersihkan sesi yang tidak aktif
 * @param {number} maxAgeMs - Usia maksimum session yang tidak aktif (dalam milidetik)
 * @returns {number} - Jumlah session yang dibersihkan
 */
function cleanupInactiveSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
  const now = new Date();
  let cleanedCount = 0;
  
  Object.keys(sessions).forEach(sessionId => {
    const session = sessions[sessionId];
    const lastActiveTime = session.lastActive || session.createdAt || new Date(0);
    const age = now - lastActiveTime;
    
    if (age > maxAgeMs) {
      // Membersihkan session yang sudah tidak aktif
      try {
        if (session.sock && typeof session.sock.close === 'function') {
          session.sock.close();
        }
        delete sessions[sessionId];
        cleanedCount++;
      } catch (error) {
        console.error(`[ERROR] Gagal membersihkan session ${sessionId}: ${error.message}`);
      }
    }
  });
  
  return cleanedCount;
}

// Jalankan cleanup session secara periodik (setiap 1 jam)
setInterval(() => {
  try {
    const cleanedCount = cleanupInactiveSessions();
    if (cleanedCount > 0) {
      console.log(`[INFO] Membersihkan ${cleanedCount} session tidak aktif`);
    }
  } catch (error) {
    console.error('[ERROR] Gagal menjalankan cleanup session:', error);
  }
}, 60 * 60 * 1000);

module.exports = {
  initializeWhatsApp,
  getWhatsAppSessions,
  getWhatsAppSession,
  getWhatsAppGroups,
  getGroupInviteLink,
  getAllGroupInviteLinks,
  changeGroupName,
  changeGroupSettings,
  promoteGroupParticipant,
  removeGroupParticipants,
  cleanupInactiveSessions,
  loadSavedSessions
};
