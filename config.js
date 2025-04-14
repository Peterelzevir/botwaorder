/**
 * Konfigurasi Global untuk WhatsApp Manager Telegram Bot
 */
module.exports = {
  // Token API Telegram Bot dari BotFather
  TELEGRAM_BOT_TOKEN: '8068335875:AAGnCBR7AxsXdr5PmX1wZBelZIcZ8bP2kcM',
  
  // Daftar User ID Telegram yang memiliki akses admin
  // Contoh: [123456789, 987654321]
  ADMIN_IDS: [
   5988451717 // Tambahkan ID Telegram admin di sini
  ],
  
  // Konfigurasi penyimpanan sesi WhatsApp
  SESSIONS_DIR: './sessions',
  
  // Timeout untuk QR code (dalam milidetik)
  QR_TIMEOUT: 60000,
  
  // Opsi debug
  DEBUG: false
};
