/**
 * Konfigurasi Bot Telegram dan WhatsApp Manager
 * Dibuat sebagai alternatif dari file .env
 */

const config = {
  // Token Bot Telegram - Dapatkan dari BotFather
  TELEGRAM_BOT_TOKEN: '8068335875:AAGnCBR7AxsXdr5PmX1wZBelZIcZ8bP2kcM',
  
  // Daftar ID Telegram yang memiliki akses admin ke bot
  // Format: Array of numbers [12345678, 87654321]
  ADMIN_USER_IDS: [5988451717, 987654321],
  
  // Konfigurasi Logging
  LOG_LEVEL: 'silent', // silent, error, warn, info, debug, trace
  
  // Path untuk menyimpan kredensial WhatsApp
  SESSION_DIR: './sessions'
};

module.exports = config;