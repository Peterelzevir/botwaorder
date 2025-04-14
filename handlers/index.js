/**
 * Indeks handler untuk callback
 */
const menuHandlers = require('./menu');
const accountHandlers = require('./account');
const groupHandlers = require('./group');

/**
 * Fungsi helper untuk escape karakter khusus dalam format HTML
 * @param {string} text - Text yang akan di-escape
 * @returns {string} - Text yang sudah di-escape
 */
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Menangani callback dari inline buttons
 * @param {Object} bot - Instance bot Telegram
 * @param {Object} callbackQuery - Objek callback query
 * @param {Object} userStates - Objek state pengguna
 */
async function handleCallbacks(bot, callbackQuery, userStates) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  try {
    // Confirm the callback was received
    await bot.answerCallbackQuery(callbackQuery.id);

    // Menu & navigasi utama
    if (data === 'add_account') {
      await accountHandlers.handleAddAccount(bot, chatId, messageId, userStates);
    } 
    else if (data === 'manage_accounts') {
      await accountHandlers.handleManageAccounts(bot, chatId, messageId);
    }
    else if (data === 'back_to_main') {
      await menuHandlers.handleBackToMain(bot, chatId, messageId);
    }
    
    // Account management
    else if (data.startsWith('account:')) {
      const sessionId = data.split(':')[1];
      await accountHandlers.handleSelectAccount(bot, chatId, messageId, sessionId);
    }
    else if (data === 'connect_qr') {
      await accountHandlers.handleConnectWithQR(bot, chatId, messageId, userStates);
    }
    else if (data === 'connect_pairing') {
      await accountHandlers.handleConnectWithPairing(bot, chatId, messageId, userStates);
    }
    else if (data === 'cancel_add_account') {
      await accountHandlers.handleCancelAddAccount(bot, chatId, messageId, userStates);
    }
    else if (data.startsWith('back_to_account:')) {
      const sessionId = data.split(':')[1];
      await accountHandlers.handleSelectAccount(bot, chatId, messageId, sessionId);
    }
    
    // Group management
    else if (data.startsWith('view_groups:')) {
      const sessionId = data.split(':')[1];
      await groupHandlers.handleViewGroups(bot, chatId, messageId, sessionId);
    }
    else if (data.startsWith('group:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleSelectGroup(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('group_link:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleGetGroupLink(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('rename_group:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleRenameGroup(bot, chatId, messageId, sessionId, groupId, userStates);
    }
    else if (data.startsWith('group_settings:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleGroupSettings(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('toggle_announce:')) {
      const [_, sessionId, groupId, value] = data.split(':');
      await groupHandlers.handleToggleGroupSetting(bot, chatId, messageId, sessionId, groupId, 'announce', value === 'true');
    }
    else if (data.startsWith('toggle_restrict:')) {
      const [_, sessionId, groupId, value] = data.split(':');
      await groupHandlers.handleToggleGroupSetting(bot, chatId, messageId, sessionId, groupId, 'restrict', value === 'true');
    }
    else if (data.startsWith('manage_members:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleManageMembers(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('promote_member:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handlePromoteMember(bot, chatId, messageId, sessionId, groupId, userStates);
    }
    else if (data.startsWith('kick_member:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleKickMember(bot, chatId, messageId, sessionId, groupId, userStates);
    }
    else if (data.startsWith('kick_all_members:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleKickAllMembers(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('confirm_kick_all:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleConfirmKickAllMembers(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('back_to_group:')) {
      const [_, sessionId, groupId] = data.split(':');
      await groupHandlers.handleSelectGroup(bot, chatId, messageId, sessionId, groupId);
    }
    else if (data.startsWith('back_to_groups:')) {
      const sessionId = data.split(':')[1];
      await groupHandlers.handleViewGroups(bot, chatId, messageId, sessionId);
    }
    else {
      // Handle unknown callback data
      console.warn(`[WARNING] Unknown callback data: ${data}`);
      await bot.sendMessage(chatId, `<b>⚠️ PERINGATAN</b>\n\nTombol atau fungsi ini tidak dikenali.`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  } catch (error) {
    console.error(`[ERROR] Error handling callback '${data}':`, error);
    
    // Format error message safely
    const errorMessage = escapeHtml(error.message || 'Unknown error');
    
    // Use HTML parse mode as it's safer than Markdown
    try {
      await bot.sendMessage(chatId, `<b>❌ ERROR</b>\n\nTerjadi kesalahan saat memproses permintaan: ${errorMessage}`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (msgError) {
      console.error('[ERROR] Failed to send error message:', msgError);
      
      // Try with plain text as last resort
      try {
        await bot.sendMessage(chatId, "Terjadi kesalahan saat memproses permintaan. Silakan kembali ke menu utama.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
            ]
          }
        });
      } catch (plainError) {
        console.error('[CRITICAL] Cannot send any messages to user:', plainError);
      }
    }
  }
}

/**
 * Fungsi untuk menangani kesalahan umum dan mengirim pesan ke pengguna
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {Error} error - Objek error
 */
async function handleError(bot, chatId, error) {
  console.error('[ERROR]:', error);
  
  // Format error message safely
  const errorMessage = escapeHtml(error.message || 'Unknown error');
  
  try {
    await bot.sendMessage(chatId, `<b>❌ ERROR</b>\n\nTerjadi kesalahan: ${errorMessage}`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  } catch (msgError) {
    console.error('[ERROR] Failed to send error message:', msgError);
    
    // Try plain text as fallback
    try {
      await bot.sendMessage(chatId, "Terjadi kesalahan. Silakan kembali ke menu utama.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Kembali ke Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (plainError) {
      console.error('[CRITICAL] Cannot send any messages to user:', plainError);
    }
  }
}

module.exports = {
  handleCallbacks,
  handleError
};
