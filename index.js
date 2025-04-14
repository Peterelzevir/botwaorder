/**
 * WhatsApp Manager Telegram Bot - Main Entry Point
 * 
 * Bot Telegram untuk mengelola akun WhatsApp dengan fitur-fitur:
 * - Menambahkan akun WhatsApp melalui QR code
 * - Melihat daftar grup WhatsApp
 * - Mendapatkan semua link grup WhatsApp
 * - Administrasi grup: ganti nama, ubah setting, kick member, dll.
 */
// Import modules
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const config = require('./config');
const adminService = require('./middleware/admin');
const { handleCallbacks, handleError } = require('./handlers');
const { loadSavedSessions } = require('./services/whatsapp');
const path = require('path');
const fs = require('fs');

// Global crypto fix untuk baileys
global.crypto = crypto;

// Inisialisasi Bot Telegram
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { 
  polling: true,
  // Opsi tambahan untuk mencegah error polling
  request: {
    timeout: 60000, // 60 detik timeout untuk request
    agent: false, // Gunakan agent default
    pool: {
      maxSockets: Infinity // Tingkatkan jumlah koneksi untuk rate limiting
    }
  },
});

// Menyimpan status percakapan user
const userStates = {};

// Implementasi mekanisme pengecekan admin
const adminChecker = adminService(bot);

// Banner console saat bot dimulai
console.log(`
=================================================
🤖 WHATSAPP MANAGER TELEGRAM BOT 🤖
=================================================
Bot telah diaktifkan!
Perintah yang tersedia:
/start - Memulai bot
=================================================
`);

// Memastikan direktori sessions ada
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[INFO] Direktori dibuat: ${dirPath}`);
  }
}

// Pemulihan sesi yang tersimpan saat startup
async function restoreSavedSessions() {
  try {
    ensureDirectoryExists(config.SESSIONS_DIR);
    console.log('[INFO] Memulihkan sesi WhatsApp tersimpan...');
    await loadSavedSessions();
    console.log('[INFO] Proses pemulihan sesi selesai');
  } catch (error) {
    console.error('[ERROR] Gagal memulihkan sesi:', error);
  }
}

// Handler untuk perintah /start dengan pengecekan admin inline
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    // Validasi akses admin
    if (!adminChecker.isAdmin(userId)) {
      return bot.sendMessage(chatId, "⛔ Akses ditolak: Anda tidak memiliki hak admin untuk menggunakan bot ini.", {
        parse_mode: 'Markdown'
      });
    }
    
    // Proses normal untuk user yang terautentikasi
    userStates[chatId] = { state: 'idle' };
    const welcomeMessage = `
🤖 *WHATSAPP MANAGER BOT* 🤖

Selamat datang di Bot Manager WhatsApp!
Bot ini memungkinkan Anda untuk mengelola akun WhatsApp Anda langsung dari Telegram.

⚠️ *PERHATIAN* ⚠️
Anda harus terlebih dahulu menghubungkan akun WhatsApp sebelum menggunakan fitur lainnya.
Silakan gunakan tombol di bawah untuk mulai.
`;
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Tambah Akun WhatsApp', callback_data: 'add_account' }],
          [{ text: '📱 Kelola Akun WhatsApp', callback_data: 'manage_accounts' }]
        ]
      }
    });
  } catch (error) {
    console.error('[ERROR] Error in /start command:', error);
    
    // Send simplified error message to user
    try {
      await bot.sendMessage(chatId, '❌ *ERROR*\n\nTerjadi kesalahan saat memulai bot. Silakan coba lagi.', {
        parse_mode: 'Markdown'
      });
    } catch (msgError) {
      console.error('[ERROR] Failed to send error message:', msgError);
    }
  }
});

// Handler untuk callback dengan validasi admin terintegrasi
bot.on('callback_query', async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  
  try {
    // Validasi akses admin
    if (!adminChecker.isAdmin(userId)) {
      return bot.answerCallbackQuery(callbackQuery.id, 
        "⛔ Akses ditolak: Anda tidak memiliki hak admin untuk menggunakan fitur ini.", {
          show_alert: true
        });
    }
    
    // Proses callback untuk user yang terautentikasi
    await handleCallbacks(bot, callbackQuery, userStates);
  } catch (error) {
    console.error('[CRITICAL] Unhandled error in callback handling:', error);
    
    // Mencoba memberi tahu user tentang error
    try {
      await bot.answerCallbackQuery(callbackQuery.id, "Terjadi kesalahan. Mohon coba lagi.", {
        show_alert: true
      });
      
      // Send more detailed error message
      await bot.sendMessage(chatId, `❌ *ERROR*\n\nTerjadi kesalahan saat memproses permintaan: ${error.message}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (notifyError) {
      console.error('[ERROR] Failed to notify user of error:', notifyError);
    }
  }
});

// Handler untuk menangkap pesan yang tidak diproses oleh handler lain
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Abaikan pesan jika bukan dari admin atau sudah dalam state tertentu
  if (!adminChecker.isAdmin(userId) || userStates[chatId]) {
    return;
  }
  
  // Jika tidak ada handler yang menangkap, berikan panduan
  bot.sendMessage(chatId, "📌 *PANDUAN PENGGUNAAN*\n\nGunakan perintah /start untuk mulai menggunakan bot ini.", {
    parse_mode: 'Markdown'
  });
});

// Handler untuk error polling dengan reconnect yang lebih robust
bot.on('polling_error', (error) => {
  console.error('[POLLING ERROR]:', error);
  
  // Implementasi strategi reconnect yang robust
  if (error.code === 'ETELEGRAM' || error.code === 'EFATAL' || error.code === 'ECONNRESET' || 
      error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    console.log('[RECONNECT] Attempting to restart polling in 10 seconds...');
    
    // Gunakan flag untuk mencegah multiple restart
    if (!global.isReconnecting) {
      global.isReconnecting = true;
      
      // Stop polling first
      bot.stopPolling()
        .then(() => {
          console.log('[RECONNECT] Polling stopped successfully');
          
          // Restart polling after delay
          setTimeout(() => {
            try {
              bot.startPolling();
              console.log('[RECONNECT] Polling restarted successfully');
              global.isReconnecting = false;
            } catch (restartError) {
              console.error('[CRITICAL] Failed to restart polling:', restartError);
              global.isReconnecting = false;
              
              // Jika gagal, coba lagi setelah delay lebih lama
              setTimeout(() => {
                try {
                  bot.startPolling();
                  console.log('[RECONNECT] Polling restarted successfully on second attempt');
                } catch (error) {
                  console.error('[FATAL] Failed to restart polling on second attempt:', error);
                  // Di titik ini mungkin perlu restart aplikasi
                  process.exit(1);
                }
              }, 30000); // 30 detik
            }
          }, 10000); // 10 detik
        })
        .catch(stopError => {
          console.error('[ERROR] Failed to stop polling:', stopError);
          global.isReconnecting = false;
          
          // Jika gagal berhenti, coba restart langsung
          setTimeout(() => {
            try {
              bot.startPolling();
              console.log('[RECONNECT] Polling force-restarted successfully');
            } catch (error) {
              console.error('[FATAL] Failed to force-restart polling:', error);
            }
          }, 15000); // 15 detik
        });
    }
  }
});

// Cleanup handler untuk exit
process.on('SIGINT', async () => {
  console.log('Shutting down bot gracefully...');
  
  try {
    // Stop telegram bot polling
    await bot.stopPolling();
    console.log('Bot polling stopped');
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
  
  // Exit with success code
  process.exit(0);
});

// Handler untuk uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION] This is a critical error that should be fixed:');
  console.error(error);
  
  // Tidak langsung exit agar layanan tetap berjalan
  // Process mungkin dalam keadaan tidak stabil, tapi mencoba untuk tetap hidup
});

// Handler untuk unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] Promise rejection was not handled:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  
  // Tidak langsung exit agar layanan tetap berjalan
});

// Memulihkan sesi yang tersimpan saat startup
restoreSavedSessions();

console.log('Bot telah dimulai. Tekan Ctrl+C untuk menghentikan.');
