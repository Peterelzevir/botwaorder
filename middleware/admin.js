/**
 * Modul Validasi Admin untuk Telegram Bot
 * Menyediakan fungsi-fungsi untuk memvalidasi hak akses admin pada bot
 */
const config = require('../config');

/**
 * Factory function untuk membuat service validasi admin
 * @param {TelegramBot} bot - Instance dari bot Telegram
 * @returns {Object} Objek yang berisi fungsi-fungsi validasi admin
 */
function createAdminService(bot) {
  return {
    /**
     * Memeriksa apakah user ID tertentu memiliki hak admin
     * @param {number} userId - ID Telegram user yang akan diperiksa
     * @returns {boolean} Status admin dari user
     */
    isAdmin: function(userId) {
      // Menggunakan array ADMIN_IDS dari config untuk memvalidasi
      return Array.isArray(config.ADMIN_IDS) && config.ADMIN_IDS.includes(userId);
    },
    
    /**
     * Memvalidasi dan memberi notifikasi jika user bukan admin
     * @param {number} userId - ID Telegram user yang akan diperiksa
     * @param {number} chatId - ID chat untuk mengirim pesan penolakan
     * @returns {Promise<boolean>} Status validasi
     */
    validateAdmin: async function(userId, chatId) {
      if (this.isAdmin(userId)) {
        return true;
      }
      
      // Kirim pesan penolakan jika user bukan admin
      if (chatId) {
        await bot.sendMessage(chatId, 
          "⛔ Akses ditolak: Anda tidak memiliki hak admin untuk menggunakan bot ini.");
      }
      return false;
    },
    
    /**
     * Higher-order function untuk membungkus handler dengan validasi admin
     * @param {Function} handler - Function handler yang akan dibungkus
     * @returns {Function} Handler yang sudah dibungkus dengan validasi admin
     */
    withAdminCheck: function(handler) {
      return async (msg, ...args) => {
        const userId = msg.from ? msg.from.id : null;
        const chatId = msg.chat ? msg.chat.id : null;
        
        // Proses hanya jika validasi admin berhasil
        if (await this.validateAdmin(userId, chatId)) {
          return handler(msg, ...args);
        }
      };
    }
  };
}

module.exports = createAdminService;
