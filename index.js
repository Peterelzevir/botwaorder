/**
 * WhatsApp Manager Telegram Bot - Main Entry Point
 * 
 * Bot Telegram untuk mengelola akun WhatsApp dengan fitur-fitur:
 * - Menambahkan akun WhatsApp melalui QR atau pairing code
 * - Melihat daftar grup WhatsApp
 * - Salin link grup WhatsApp
 * - Administrasi grup: ganti nama, ubah setting, kick member, dll.
 */
// Import modules
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const config = require('./config');
const adminService = require('./middleware/admin');
const { handleCallbacks } = require('./handlers');

// Global crypto fix untuk baileys
global.crypto = crypto;

// Inisialisasi Bot Telegram
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

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

// Handler untuk perintah /start dengan pengecekan admin inline
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Validasi akses admin
  if (!adminChecker.isAdmin(userId)) {
    return bot.sendMessage(chatId, "⛔ Akses ditolak: Anda tidak memiliki hak admin untuk menggunakan bot ini.");
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
});

// Handler untuk callback dengan validasi admin terintegrasi
bot.on('callback_query', async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  
  // Validasi akses admin
  if (!adminChecker.isAdmin(userId)) {
    return bot.answerCallbackQuery(callbackQuery.id, 
      "⛔ Akses ditolak: Anda tidak memiliki hak admin untuk menggunakan fitur ini.");
  }
  
  // Proses callback untuk user yang terautentikasi
  await handleCallbacks(bot, callbackQuery, userStates);
});

// Error handler
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Bot telah dimulai. Tekan Ctrl+C untuk menghentikan.');
