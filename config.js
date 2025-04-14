/**
 * Konfigurasi Global untuk WhatsApp Manager Telegram Bot
 * Dengan pendekatan nilai statis tanpa ketergantungan pada environment variables
 */
const path = require('path');

module.exports = {
  // Token API Telegram Bot dari BotFather
  TELEGRAM_BOT_TOKEN: '8068335875:AAGnCBR7AxsXdr5PmX1wZBelZIcZ8bP2kcM',
  
  // Daftar User ID Telegram yang memiliki akses admin
  // Format: array of numbers
  ADMIN_IDS: [
    5988451717, // Ganti dengan User ID admin Telegram Anda
    // Tambahkan ID admin lainnya di sini jika diperlukan
  ],
  
  // Konfigurasi penyimpanan sesi WhatsApp
  SESSIONS_DIR: path.join(__dirname, 'sessions'),
  
  // Alias untuk kompatibilitas dengan kode legacy
  get SESSION_DIR() {
    console.warn('[DEPRECATED] SESSION_DIR digunakan, gunakan SESSIONS_DIR sebagai gantinya');
    return this.SESSIONS_DIR;
  },
  
  // Level logging untuk pino logger
  // Options: fatal, error, warn, info, debug, trace, silent
  LOG_LEVEL: 'warn',
  
  // Timeout untuk QR code (dalam milidetik)
  QR_TIMEOUT: 60000,
  
  // Interval reconnect WhatsApp (dalam milidetik)
  WA_RECONNECT_INTERVAL: 5000,
  
  // Maksimum percobaan reconnect WhatsApp
  WA_MAX_RECONNECT_RETRIES: 5,
  
  // Mode debug
  DEBUG: false,
  
  // Validasi konfigurasi pada startup
  validate() {
    // Verifikasi token Telegram
    if (!this.TELEGRAM_BOT_TOKEN || this.TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      throw new Error('Token Telegram Bot tidak valid. Harap konfigurasi TELEGRAM_BOT_TOKEN di config.js');
    }
    
    // Verifikasi array ADMIN_IDS
    if (!Array.isArray(this.ADMIN_IDS) || this.ADMIN_IDS.length === 0 || this.ADMIN_IDS.includes(123456789)) {
      console.warn('[PERINGATAN] ADMIN_IDS belum dikonfigurasi dengan benar. Pastikan untuk menggantinya dengan ID Telegram Anda sendiri.');
    }
    
    // Verifikasi nilai lainnya
    const numericParams = ['QR_TIMEOUT', 'WA_RECONNECT_INTERVAL', 'WA_MAX_RECONNECT_RETRIES'];
    numericParams.forEach(param => {
      if (typeof this[param] !== 'number' || this[param] <= 0) {
        throw new Error(`Parameter ${param} harus berupa angka positif`);
      }
    });
    
    return true;
  }
};
