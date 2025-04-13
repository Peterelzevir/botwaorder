/**
 * Middleware untuk memeriksa apakah pengguna adalah admin bot
 */
const config = require('../config');

/**
 * Factory function untuk membuat middleware admin
 * @param {Object} bot - Instance bot Telegram
 * @returns {Function} - Middleware function
 */
function createAdminMiddleware(bot) {
  /**
   * Middleware untuk memeriksa apakah pengguna adalah admin bot
   * @param {Object} msg - Objek pesan Telegram
   * @param {Function} next - Fungsi next untuk melanjutkan eksekusi
   */
  return function adminMiddleware(msg, next) {
    const admins = config.ADMIN_USER_IDS;
    
    // Jika pesan dari callback query
    if (msg.callback_query) {
      const userId = msg.callback_query.from.id;
      if (admins.includes(userId)) {
        return next();
      } else {
        // Kirim pesan error dan jangan lanjutkan
        bot.answerCallbackQuery(
          msg.callback_query.id,
          { text: '⛔ Anda tidak memiliki izin untuk menggunakan bot ini!' }
        );
        return;
      }
    }
    
    // Jika pesan biasa
    const userId = msg.from.id;
    if (admins.includes(userId)) {
      return next();
    } else {
      // Kirim pesan error
      bot.sendMessage(
        msg.chat.id,
        '⛔ *AKSES DITOLAK*\n\nAnda tidak memiliki izin untuk menggunakan bot ini!',
        { parse_mode: 'Markdown' }
      );
      return;
    }
  };
}

module.exports = createAdminMiddleware;