/**
 * Handler untuk manajemen grup WhatsApp
 */
const {
  getWhatsAppSession,
  getWhatsAppGroups,
  getGroupInviteLink,
  changeGroupName,
  changeGroupSettings,
  promoteGroupParticipant,
  removeGroupParticipants
} = require('../services/whatsapp');

/**
 * Menangani melihat daftar grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleViewGroups(bot, chatId, messageId, sessionId) {
  const session = getWhatsAppSession(sessionId);
  
  if (!session || !session.connected) {
    await bot.editMessageText('❌ *AKUN TIDAK TERHUBUNG*\n\nAkun WhatsApp yang Anda pilih tidak terhubung.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
    return;
  }

  try {
    await bot.editMessageText('⏳ *MENGAMBIL DATA*\n\nSedang mengambil daftar grup...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const groups = await getWhatsAppGroups(sessionId);
    
    if (groups.length === 0) {
      await bot.editMessageText('⚠️ *TIDAK ADA GRUP*\n\nAnda tidak memiliki grup WhatsApp.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Akun', callback_data: `back_to_account:${sessionId}` }]
          ]
        }
      });
      return;
    }

    const keyboard = groups.map(group => {
      return [{ text: `👥 ${group.name}`, callback_data: `group:${sessionId}:${group.id}` }];
    });

    keyboard.push([{ text: '🔙 Kembali ke Akun', callback_data: `back_to_account:${sessionId}` }]);

    await bot.editMessageText(`📋 *DAFTAR GRUP*\n\nTotal: ${groups.length} grup\n\nPilih grup untuk mengelola:`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat mengambil daftar grup: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Akun', callback_data: `back_to_account:${sessionId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani pemilihan grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleSelectGroup(bot, chatId, messageId, sessionId, groupId) {
  const session = getWhatsAppSession(sessionId);
  
  if (!session || !session.connected) {
    await bot.editMessageText('❌ *AKUN TIDAK TERHUBUNG*\n\nAkun WhatsApp yang Anda pilih tidak terhubung.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
    return;
  }

  try {
    const groups = await getWhatsAppGroups(sessionId);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
      await bot.editMessageText('❌ *GRUP TIDAK DITEMUKAN*\n\nGrup WhatsApp yang Anda pilih tidak ditemukan.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Daftar Grup', callback_data: `back_to_groups:${sessionId}` }]
          ]
        }
      });
      return;
    }

    // Hitung jumlah admin dan member
    const admins = group.participants.filter(p => p.isAdmin).length;
    const members = group.participants.length - admins;

    await bot.editMessageText(`👥 *DETAIL GRUP*\n\nNama: ${group.name}\nTotal Anggota: ${group.participants.length}\nAdmin: ${admins}\nMember: ${members}\n\nPilih tindakan:`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Salin Link Grup', callback_data: `group_link:${sessionId}:${groupId}` }],
          [{ text: '✏️ Ubah Nama Grup', callback_data: `rename_group:${sessionId}:${groupId}` }],
          [{ text: '⚙️ Pengaturan Grup', callback_data: `group_settings:${sessionId}:${groupId}` }],
          [{ text: '👥 Kelola Anggota', callback_data: `manage_members:${sessionId}:${groupId}` }],
          [{ text: '🔙 Kembali ke Daftar Grup', callback_data: `back_to_groups:${sessionId}` }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat mengambil detail grup: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Daftar Grup', callback_data: `back_to_groups:${sessionId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani mendapatkan link grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleGetGroupLink(bot, chatId, messageId, sessionId, groupId) {
  try {
    await bot.editMessageText('⏳ *MENGAMBIL DATA*\n\nSedang mengambil link grup...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const link = await getGroupInviteLink(sessionId, groupId);
    
    await bot.editMessageText(`🔗 *LINK GRUP*\n\n${link}\n\nLink berhasil diambil!`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Link', callback_data: `group_link:${sessionId}:${groupId}` }],
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat mengambil link grup: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani mengubah nama grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {Object} userStates - Objek state pengguna
 */
async function handleRenameGroup(bot, chatId, messageId, sessionId, groupId, userStates) {
  try {
    const groups = await getWhatsAppGroups(sessionId);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
      throw new Error('Grup tidak ditemukan');
    }

    userStates[chatId] = { 
      state: 'renaming_group',
      sessionId,
      groupId
    };

    await bot.editMessageText(`✏️ *UBAH NAMA GRUP*\n\nNama Saat Ini: ${group.name}\n\nKirim nama baru untuk grup ini:`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Batal', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });

    // Listener untuk nama baru
    bot.once('message', async (msg) => {
      if (msg.chat.id !== chatId || 
          userStates[chatId]?.state !== 'renaming_group' ||
          userStates[chatId]?.sessionId !== sessionId ||
          userStates[chatId]?.groupId !== groupId) {
        return;
      }

      const newName = msg.text.trim();
      
      if (newName.length < 1 || newName.length > 25) {
        await bot.sendMessage(chatId, '❌ *NAMA TIDAK VALID*\n\nNama grup harus antara 1-25 karakter.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
            ]
          }
        });
        return;
      }

      const statusMsg = await bot.sendMessage(chatId, '⏳ *MENGUBAH NAMA*\n\nSedang mengubah nama grup...', {
        parse_mode: 'Markdown'
      });

      try {
        await changeGroupName(sessionId, groupId, newName);
        userStates[chatId] = { state: 'idle' };
        
        await bot.editMessageText('✅ *BERHASIL*\n\nNama grup berhasil diubah!', {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
            ]
          }
        });
      } catch (error) {
        userStates[chatId] = { state: 'idle' };
        
        await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat mengubah nama grup: ${error.message}`, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
            ]
          }
        });
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani pengaturan grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleGroupSettings(bot, chatId, messageId, sessionId, groupId) {
  await bot.editMessageText('⚙️ *PENGATURAN GRUP*\n\nPilih pengaturan yang ingin diubah:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 Hanya Admin yang Dapat Mengirim Pesan', callback_data: `toggle_announce:${sessionId}:${groupId}:true` }],
        [{ text: '🔓 Semua Anggota Dapat Mengirim Pesan', callback_data: `toggle_announce:${sessionId}:${groupId}:false` }],
        [{ text: '🔒 Hanya Admin yang Dapat Mengubah Info Grup', callback_data: `toggle_restrict:${sessionId}:${groupId}:true` }],
        [{ text: '🔓 Semua Anggota Dapat Mengubah Info Grup', callback_data: `toggle_restrict:${sessionId}:${groupId}:false` }],
        [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
      ]
    }
  });
}

/**
 * Menangani toggle pengaturan grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {string} setting - Pengaturan yang diubah ('announce' atau 'restrict')
 * @param {boolean} value - Nilai pengaturan
 */
async function handleToggleGroupSetting(bot, chatId, messageId, sessionId, groupId, setting, value) {
  try {
    await bot.editMessageText('⏳ *MENGUBAH PENGATURAN*\n\nSedang mengubah pengaturan grup...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    const settings = {};
    settings[setting] = value;

    await changeGroupSettings(sessionId, groupId, settings);
    
    const settingName = setting === 'announce' 
      ? 'Pengaturan Pesan' 
      : 'Pengaturan Info Grup';
    
    const settingStatus = value 
      ? 'dikunci (hanya admin)' 
      : 'dibuka (semua anggota)';

    await bot.editMessageText(`✅ *BERHASIL*\n\n${settingName} berhasil ${settingStatus}!`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚙️ Pengaturan Lainnya', callback_data: `group_settings:${sessionId}:${groupId}` }],
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat mengubah pengaturan grup: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Pengaturan', callback_data: `group_settings:${sessionId}:${groupId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani kelola anggota grup
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleManageMembers(bot, chatId, messageId, sessionId, groupId) {
  await bot.editMessageText('👥 *KELOLA ANGGOTA*\n\nPilih tindakan untuk anggota grup:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '👑 Jadikan Admin', callback_data: `promote_member:${sessionId}:${groupId}` }],
        [{ text: '🚫 Kick Anggota', callback_data: `kick_member:${sessionId}:${groupId}` }],
        [{ text: '⚠️ Kick Semua Anggota', callback_data: `kick_all_members:${sessionId}:${groupId}` }],
        [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
      ]
    }
  });
}

/**
 * Menangani jadikan admin
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {Object} userStates - Objek state pengguna
 */
async function handlePromoteMember(bot, chatId, messageId, sessionId, groupId, userStates) {
  userStates[chatId] = { 
    state: 'promoting_member',
    sessionId,
    groupId
  };

  await bot.editMessageText('👑 *JADIKAN ADMIN*\n\nKirim nomor WhatsApp yang ingin dijadikan admin.\nFormat: 628xxxxxxxxxx (tanpa tanda + atau spasi)', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Batal', callback_data: `back_to_group:${sessionId}:${groupId}` }]
      ]
    }
  });

  // Listener untuk nomor yang akan dijadikan admin
  bot.once('message', async (msg) => {
    if (msg.chat.id !== chatId || 
        userStates[chatId]?.state !== 'promoting_member' ||
        userStates[chatId]?.sessionId !== sessionId ||
        userStates[chatId]?.groupId !== groupId) {
      return;
    }

    const phoneNumber = msg.text.trim();
    
    // Validasi format nomor telepon
    if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
      await bot.sendMessage(chatId, '❌ *FORMAT SALAH*\n\nFormat nomor telepon tidak valid. Gunakan format internasional tanpa tanda + (contoh: 628123456789).', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
      return;
    }

    const statusMsg = await bot.sendMessage(chatId, '⏳ *MENJADIKAN ADMIN*\n\nSedang menjadikan anggota sebagai admin...', {
      parse_mode: 'Markdown'
    });

    try {
      // Format nomor ke format JID WhatsApp
      const participantId = `${phoneNumber}@s.whatsapp.net`;
      
      await promoteGroupParticipant(sessionId, groupId, participantId);
      userStates[chatId] = { state: 'idle' };
      
      await bot.editMessageText('✅ *BERHASIL*\n\nAnggota berhasil dijadikan admin!', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
    } catch (error) {
      userStates[chatId] = { state: 'idle' };
      
      await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
    }
  });
}

/**
 * Menangani kick anggota
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 * @param {Object} userStates - Objek state pengguna
 */
async function handleKickMember(bot, chatId, messageId, sessionId, groupId, userStates) {
  userStates[chatId] = { 
    state: 'kicking_member',
    sessionId,
    groupId
  };

  await bot.editMessageText('🚫 *KICK ANGGOTA*\n\nKirim nomor WhatsApp yang ingin di-kick.\nFormat: 628xxxxxxxxxx (tanpa tanda + atau spasi)', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Batal', callback_data: `back_to_group:${sessionId}:${groupId}` }]
      ]
    }
  });

  // Listener untuk nomor yang akan di-kick
  bot.once('message', async (msg) => {
    if (msg.chat.id !== chatId || 
        userStates[chatId]?.state !== 'kicking_member' ||
        userStates[chatId]?.sessionId !== sessionId ||
        userStates[chatId]?.groupId !== groupId) {
      return;
    }

    const phoneNumber = msg.text.trim();
    
    // Validasi format nomor telepon
    if (!/^[0-9]{10,15}$/.test(phoneNumber)) {
      await bot.sendMessage(chatId, '❌ *FORMAT SALAH*\n\nFormat nomor telepon tidak valid. Gunakan format internasional tanpa tanda + (contoh: 628123456789).', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
      return;
    }

    const statusMsg = await bot.sendMessage(chatId, '⏳ *MENGELUARKAN ANGGOTA*\n\nSedang mengeluarkan anggota dari grup...', {
      parse_mode: 'Markdown'
    });

    try {
      // Format nomor ke format JID WhatsApp
      const participantId = `${phoneNumber}@s.whatsapp.net`;
      
      await removeGroupParticipants(sessionId, groupId, [participantId]);
      userStates[chatId] = { state: 'idle' };
      
      await bot.editMessageText('✅ *BERHASIL*\n\nAnggota berhasil dikeluarkan dari grup!', {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
    } catch (error) {
      userStates[chatId] = { state: 'idle' };
      
      await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
    }
  });
}

/**
 * Menangani kick semua anggota
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleKickAllMembers(bot, chatId, messageId, sessionId, groupId) {
  try {
    // Konfirmasi terlebih dahulu
    await bot.editMessageText('⚠️ *PERINGATAN*\n\nAnda akan mengeluarkan SEMUA anggota dari grup ini (kecuali admin).\n\nApakah Anda yakin?', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Ya, Kick Semua', callback_data: `confirm_kick_all:${sessionId}:${groupId}` }],
          [{ text: '❌ Batalkan', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  }
}

/**
 * Menangani konfirmasi kick semua anggota
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 * @param {string} groupId - ID grup WhatsApp
 */
async function handleConfirmKickAllMembers(bot, chatId, messageId, sessionId, groupId) {
  await bot.editMessageText('⏳ *MENGELUARKAN SEMUA ANGGOTA*\n\nSedang mengeluarkan semua anggota dari grup. Ini mungkin memerlukan waktu beberapa saat...', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown'
  });

  try {
    const groups = await getWhatsAppGroups(sessionId);
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
      throw new Error('Grup tidak ditemukan');
    }

    // Filter hanya anggota non-admin
    const nonAdminParticipants = group.participants
      .filter(p => !p.isAdmin)
      .map(p => p.id);

    if (nonAdminParticipants.length === 0) {
      await bot.editMessageText('⚠️ *TIDAK ADA ANGGOTA*\n\nTidak ada anggota non-admin yang dapat dikeluarkan.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
          ]
        }
      });
      return;
    }

    // Mengeluarkan anggota dalam batch untuk menghindari rate limit
    const batchSize = 5;
    for (let i = 0; i < nonAdminParticipants.length; i += batchSize) {
      const batch = nonAdminParticipants.slice(i, i + batchSize);
      await removeGroupParticipants(sessionId, groupId, batch);
      
      // Berikan waktu untuk menghindari rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await bot.editMessageText(`✅ *BERHASIL*\n\n${nonAdminParticipants.length} anggota berhasil dikeluarkan dari grup!`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Grup', callback_data: `back_to_group:${sessionId}:${groupId}` }]
        ]
      }
    });
  }
}

module.exports = {
  handleViewGroups,
  handleSelectGroup,
  handleGetGroupLink,
  handleRenameGroup,
  handleGroupSettings,
  handleToggleGroupSetting,
  handleManageMembers,
  handlePromoteMember,
  handleKickMember,
  handleKickAllMembers,
  handleConfirmKickAllMembers
};