/**
 * Integrasi dengan WhatsApp menggunakan @whiskeysockets/baileys
 */
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore,
  jidDecode
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const config = require('../config');

// Store untuk menyimpan semua session WhatsApp
const sessions = {};

/**
 * Fungsi untuk menginisialisasi koneksi WhatsApp baru
 * @param {string} sessionId - ID unik untuk session WhatsApp
 * @param {function} qrCallback - Callback yang dipanggil ketika QR code siap
 * @param {function} connectionCallback - Callback yang dipanggil ketika status koneksi berubah
 */
async function initializeWhatsApp(sessionId, qrCallback, connectionCallback) {
  // Membuat folder untuk menyimpan autentikasi
  const sessionFolder = path.join(config.SESSION_DIR, sessionId);
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  // Menggunakan multi file auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  // Mengambil versi terbaru Baileys
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Menggunakan WA v${version.join('.')}, terbaru: ${isLatest}`);

  // Store untuk menyimpan pesan
  const store = makeInMemoryStore({});
  store.readFromFile(path.join(sessionFolder, 'store.json'));
  setInterval(() => {
    store.writeToFile(path.join(sessionFolder, 'store.json'));
  }, 10000);

  // Membuat socket WhatsApp dengan mengikuti dokumentasi baileys terbaru
  const sock = makeWASocket({
    version,
    logger: pino({ level: config.LOG_LEVEL }),
    printQRInTerminal: false,
    auth: state,
    browser: ['WhatsApp Manager Bot', 'Chrome', '3.0.0'],
    // Tambahan opsi sesuai dokumentasi terbaru
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return {
        conversation: 'Pesan tidak tersedia'
      };
    }
  });

  // Menyimpan session
  sessions[sessionId] = {
    sock,
    store,
    connected: false
  };

  // Menangani QR code sesuai dengan dokumentasi terbaru
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Gunakan qrcode library untuk menghasilkan QR code sebagai string ASCII
      try {
        const qrCode = await qrcode.toString(qr, {
          type: 'terminal',
          small: true
        });
        qrCallback(qrCode);
      } catch (error) {
        console.error('Error generating QR code:', error);
        qrCallback(qr); // Fallback to raw QR data
      }
    }

    if (connection === 'close') {
      const shouldReconnect = 
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log('Koneksi ditutup karena ', lastDisconnect?.error, ', menghubungkan kembali...');
        initializeWhatsApp(sessionId, qrCallback, connectionCallback);
      } else {
        console.log('Koneksi ditutup karena logout');
        delete sessions[sessionId];
        connectionCallback('disconnected');
      }
    } else if (connection === 'open') {
      console.log('Koneksi terbuka');
      sessions[sessionId].connected = true;
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
 * Fungsi untuk mengkoneksikan WhatsApp menggunakan pairing code
 * Mengikuti dokumentasi terbaru dari baileys
 * @param {string} sessionId - ID unik untuk session WhatsApp
 * @param {string} phoneNumber - Nomor telepon untuk pairing (format: 628xxxxxxxxxx)
 * @param {function} connectionCallback - Callback yang dipanggil ketika status koneksi berubah
 */
async function connectWithPairingCode(sessionId, phoneNumber, connectionCallback) {
  // Membuat folder untuk menyimpan autentikasi
  const sessionFolder = path.join(config.SESSION_DIR, sessionId);
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  // Menggunakan multi file auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  // Mengambil versi terbaru Baileys
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  // Store untuk menyimpan pesan
  const store = makeInMemoryStore({});
  store.readFromFile(path.join(sessionFolder, 'store.json'));
  
  // Membuat socket WhatsApp dengan mengikuti dokumentasi baileys terbaru
  const sock = makeWASocket({
    version,
    logger: pino({ level: config.LOG_LEVEL }),
    printQRInTerminal: false,
    auth: state,
    browser: ['WhatsApp Manager Bot', 'Chrome', '3.0.0'],
    // Opsi tambahan sesuai dokumentasi
    mobile: false,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return {
        conversation: 'Pesan tidak tersedia'
      };
    }
  });

  // Menyimpan session
  sessions[sessionId] = {
    sock,
    store,
    connected: false
  };

  // Menangani status koneksi
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = 
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      
      if (shouldReconnect) {
        console.log('Koneksi ditutup karena ', lastDisconnect?.error, ', menghubungkan kembali...');
        initializeWhatsApp(sessionId, () => {}, connectionCallback);
      } else {
        console.log('Koneksi ditutup karena logout');
        delete sessions[sessionId];
        connectionCallback('disconnected');
      }
    } else if (connection === 'open') {
      console.log('Koneksi terbuka');
      sessions[sessionId].connected = true;
      connectionCallback('connected');
    }
  });

  // Menyimpan kredensial
  sock.ev.on('creds.update', saveCreds);

  // Menyinkronkan pesan dengan store
  store.bind(sock.ev);

  // Mendapatkan kode pairing
  // Implementasi sesuai dengan dokumentasi baileys terbaru
  try {
    if (!phoneNumber.endsWith('@s.whatsapp.net')) {
      // Format nomor telepon ke format yang benar
      if (phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.substring(1);
      }
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
      }
    }
    
    // Implementasi requestPairingCode sesuai dokumentasi terbaru
    const code = await sock.requestPairingCode(phoneNumber);
    connectionCallback('pairing_code', code);
  } catch (error) {
    console.error('Error saat meminta kode pairing:', error);
    connectionCallback('error', error.message);
  }

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
  return sessions[sessionId] || null;
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
        name: chat.subject,
        participants: chat.participants.map(p => ({
          id: p.id,
          isAdmin: p.admin ? true : false
        }))
      });
    }
  } catch (error) {
    console.error('Error saat mengambil grup:', error);
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
    console.error('Error saat mengambil link grup:', error);
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
    console.error('Error saat mengubah nama grup:', error);
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
    console.error('Error saat mengubah pengaturan grup:', error);
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
    console.error('Error saat mempromosikan peserta:', error);
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
    console.error('Error saat mengeluarkan peserta:', error);
    throw error;
  }
}

module.exports = {
  initializeWhatsApp,
  connectWithPairingCode,
  getWhatsAppSessions,
  getWhatsAppSession,
  getWhatsAppGroups,
  getGroupInviteLink,
  changeGroupName,
  changeGroupSettings,
  promoteGroupParticipant,
  removeGroupParticipants
};