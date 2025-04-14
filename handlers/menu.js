/**
 * Handler untuk menu dan navigasi utama
 */

/**
 * Menghasilkan menu utama bot
 * @returns {Object} - Objek reply_markup untuk menu utama
 */
function generateMainMenu() {
  return {
    inline_keyboard: [
      [{ text: '➕ Tambah Akun WhatsApp', callback_data: 'add_account' }],
      [{ text: '📱 Kelola Akun WhatsApp', callback_data: 'manage_accounts' }]
    ]
  };
}

/**
 * Menangani kembali ke menu utama
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 */
async function handleBackToMain(bot, chatId, messageId) {
  await bot.editMessageText('🤖 **WHATSAPP MANAGER BOT** 🤖\n\nSelamat datang di Bot Manager WhatsApp!\nBot ini memungkinkan Anda untuk mengelola akun WhatsApp Anda langsung dari Telegram.', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: generateMainMenu()
  });
}

module.exports = {
  generateMainMenu,
  handleBackToMain
};
