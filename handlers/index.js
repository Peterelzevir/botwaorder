/**
 * Indeks handler untuk callback
 */
const menuHandlers = require('./menu');
const accountHandlers = require('./account');
const groupHandlers = require('./group');

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
}

module.exports = {
  handleCallbacks
};