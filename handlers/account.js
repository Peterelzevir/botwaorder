/**
 * Handler untuk manajemen akun WhatsApp
 */
const fs = require('fs');
const path = require('path');
const { generateMainMenu } = require('./menu');
const config = require('../config');
const {
  initializeWhatsApp,
  getWhatsAppSessions,
  getWhatsAppSession
} = require('../services/whatsapp');

/**
 * Menghasilkan menu untuk akun WhatsApp tertentu
 * @param {string} sessionId - ID session WhatsApp
 * @returns {Object} - Objek reply_markup untuk menu akun
 */
function generateAccountMenu(sessionId) {
  return {
    inline_keyboard: [
      [{ text: '👥 Lihat Daftar Grup', callback_data: `view_groups:${sessionId}` }],
      [{ text: '🔗 Dapatkan Semua Link Grup', callback_data: `get_all_links:${sessionId}` }],
      [{ text: '⚙️ Pengaturan Akun', callback_data: `account_settings:${sessionId}` }],
      [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
    ]
  };
}

/**
 * Menangani callback untuk menambahkan akun
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {Object} userStates - Objek state pengguna
 */
async function handleAddAccount(bot, chatId, messageId, userStates) {
  // Langsung menuju ke koneksi QR
  try {
    await handleConnectWithQR(bot, chatId, messageId, userStates);
  } catch (error) {
    console.error('[ERROR] Gagal menangani permintaan tambah akun:', error);
    
    await bot.editMessageText('❌ *ERROR*\n\nTerjadi kesalahan saat memulai koneksi. Silakan coba lagi.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Coba Lagi', callback_data: 'add_account' }],
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
}

/**
 * Menangani koneksi dengan QR code
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {Object} userStates - Objek state pengguna
 */
async function handleConnectWithQR(bot, chatId, messageId, userStates) {
  const sessionId = `session_${Date.now()}`;
  userStates[chatId] = { 
    state: 'waiting_qr_scan',
    sessionId
  };

  const statusMessage = await bot.editMessageText('⏳ *MENGHUBUNGKAN KE WHATSAPP*\n\nMempersiapkan koneksi. QR code akan muncul dalam beberapa saat...', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown'
  });

  try {
    // Inisialisasi WhatsApp dengan callback untuk QR dan status koneksi
    initializeWhatsApp(
      sessionId,
      // QR callback dengan dukungan gambar
      async (type, data) => {
        if (type === 'image') {
          try {
            // Kirim QR code sebagai gambar
            const qrBuffer = fs.readFileSync(data);
            
            // Hapus pesan status sebelumnya jika masih ada
            try {
              if (statusMessage && statusMessage.message_id) {
                await bot.deleteMessage(chatId, statusMessage.message_id);
              }
            } catch (err) {
              console.error('[ERROR] Gagal menghapus pesan lama:', err);
            }
            
            // Kirim gambar QR code dengan caption
            const msg = await bot.sendPhoto(chatId, qrBuffer, {
              caption: '📲 *SCAN QR CODE*\n\nScan QR code ini dengan WhatsApp di ponsel Anda.\nBuka WhatsApp > Menu > Perangkat Tertaut > Tautkan Perangkat',
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
                ]
              }
            });
            
            // Simpan ID pesan baru untuk pengelolaan state
            if (userStates[chatId]) {
              userStates[chatId].qrMessageId = msg.message_id;
            }
            
            // Hapus file QR sementara setelah dikirim
            try {
              fs.unlinkSync(data);
            } catch (err) {
              console.error('[ERROR] Gagal menghapus file QR:', err);
            }
          } catch (error) {
            console.error('[ERROR] Gagal mengirim QR code sebagai gambar:', error);
            // Fallback ke text mode jika gagal
            await bot.sendMessage(chatId, '❌ *GAGAL MENGIRIM QR CODE SEBAGAI GAMBAR*\n\nTerjadi kesalahan teknis. Silakan coba lagi.', {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Coba Lagi', callback_data: 'add_account' }],
                  [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
                ]
              }
            });
          }
        } else {
          // Fallback ke QR code teks jika gambar gagal
          await bot.editMessageText('📲 *SCAN QR CODE*\n\nScan QR code berikut dengan WhatsApp di ponsel Anda:\n\n```' + data + '```\n\nQR code akan kedaluwarsa dalam 20 detik.', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
              ]
            }
          });
        }
      },
      // Connection callback
      async (status, data) => {
        if (status === 'connected') {
          // Hapus pesan QR code jika masih ada
          if (userStates[chatId]?.qrMessageId) {
            try {
              await bot.deleteMessage(chatId, userStates[chatId].qrMessageId);
            } catch (err) {
              console.error('[ERROR] Gagal menghapus pesan QR:', err);
            }
          }
          
          // Reset state
          userStates[chatId] = { state: 'idle' };
          
          // Kirim pesan sukses
          await bot.sendMessage(chatId, '✅ *BERHASIL TERHUBUNG*\n\nAkun WhatsApp berhasil terhubung! Anda sekarang dapat menggunakan fitur-fitur bot.', {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📱 Kelola Akun Ini', callback_data: `account:${sessionId}` }],
                [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
              ]
            }
          });
        } else if (status === 'disconnected') {
          userStates[chatId] = { state: 'idle' };
          
          // Kirim pesan error
          await bot.sendMessage(chatId, '❌ *KONEKSI TERPUTUS*\n\nKoneksi WhatsApp terputus. Silakan coba lagi.', {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
              ]
            }
          });
        } else if (status === 'error') {
          userStates[chatId] = { state: 'idle' };
          
          // Kirim pesan error dengan detail
          await bot.sendMessage(chatId, `❌ *ERROR*\n\nTerjadi kesalahan: ${data || 'Unknown error'}`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
              ]
            }
          });
        }
      }
    );
  } catch (error) {
    userStates[chatId] = { state: 'idle' };
    
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat menghubungkan ke WhatsApp: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
}

/**
 * Menangani pembatalan penambahan akun
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {Object} userStates - Objek state pengguna
 */
async function handleCancelAddAccount(bot, chatId, messageId, userStates) {
  const currentState = userStates[chatId];
  
  // Hapus pesan QR jika masih ada
  if (currentState?.qrMessageId) {
    try {
      await bot.deleteMessage(chatId, currentState.qrMessageId);
    } catch (err) {
      console.error('[ERROR] Gagal menghapus pesan QR saat membatalkan:', err);
    }
  }
  
  // Reset state
  userStates[chatId] = { state: 'idle' };
  
  // Kirim pesan pembatalan
  try {
    await bot.editMessageText('⚠️ *DIBATALKAN*\n\nPenambahan akun WhatsApp dibatalkan.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  } catch (error) {
    console.error('[ERROR] Gagal mengedit pesan saat membatalkan:', error);
    // Fallback jika gagal edit message
    await bot.sendMessage(chatId, '⚠️ *DIBATALKAN*\n\nPenambahan akun WhatsApp dibatalkan.', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
}

/**
 * Menangani pengelolaan akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 */
async function handleManageAccounts(bot, chatId, messageId) {
  const sessions = getWhatsAppSessions();
  const sessionIds = Object.keys(sessions);

  if (sessionIds.length === 0) {
    await bot.editMessageText('⚠️ *TIDAK ADA AKUN*\n\nAnda belum menambahkan akun WhatsApp. Silakan tambahkan akun terlebih dahulu.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Tambah Akun WhatsApp', callback_data: 'add_account' }],
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
    return;
  }

  const keyboard = sessionIds.map(id => {
    const session = sessions[id];
    const status = session.connected === true ? '🟢' : '🔴';
    const displayId = id.split('_')[1] || id; // Fallback jika format tidak sesuai
    return [{ text: `${status} Session ${displayId}`, callback_data: `account:${id}` }];
  });

  keyboard.push([{ text: '➕ Tambah Akun Lain', callback_data: 'add_account' }]);
  keyboard.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]);

  await bot.editMessageText('📱 *KELOLA AKUN WHATSAPP*\n\nPilih akun WhatsApp yang ingin Anda kelola:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

/**
 * Menangani pemilihan akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleSelectAccount(bot, chatId, messageId, sessionId) {
  const session = getWhatsAppSession(sessionId);
  
  if (!session) {
    await bot.editMessageText('❌ *AKUN TIDAK DITEMUKAN*\n\nAkun WhatsApp yang Anda pilih tidak ditemukan.', {
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

  // Periksa koneksi secara eksplisit
  const isConnected = session.connected === true;
  const status = isConnected ? '🟢 Terhubung' : '🔴 Terputus';
  
  await bot.editMessageText(`📱 *DETAIL AKUN WHATSAPP*\n\nID: ${sessionId}\nStatus: ${status}\n\nPilih tindakan:`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: generateAccountMenu(sessionId)
  });
}

/**
 * Menangani pengaturan akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleAccountSettings(bot, chatId, messageId, sessionId) {
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

  await bot.editMessageText('⚙️ *PENGATURAN AKUN WHATSAPP*\n\nPilih pengaturan yang ingin diubah:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Logout', callback_data: `logout_account:${sessionId}` }],
        [{ text: '❌ Hapus Akun dari Bot', callback_data: `delete_account:${sessionId}` }],
        [{ text: '🔙 Kembali ke Detail Akun', callback_data: `account:${sessionId}` }]
      ]
    }
  });
}

/**
 * Menangani logout akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleLogoutAccount(bot, chatId, messageId, sessionId) {
  // Konfirmasi terlebih dahulu
  await bot.editMessageText('⚠️ *LOGOUT AKUN*\n\nAnda akan logout dari akun WhatsApp ini. Apakah Anda yakin?\n\nPerhatian: Anda perlu scan QR code lagi untuk menggunakan akun ini.', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Ya, Logout', callback_data: `confirm_logout:${sessionId}` }],
        [{ text: '❌ Batalkan', callback_data: `account:${sessionId}` }]
      ]
    }
  });
}

/**
 * Menangani hapus akun WhatsApp dari bot
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleDeleteAccount(bot, chatId, messageId, sessionId) {
  // Konfirmasi terlebih dahulu
  await bot.editMessageText('⚠️ *HAPUS AKUN*\n\nAnda akan menghapus akun WhatsApp ini dari bot. Apakah Anda yakin?\n\nPerhatian: Semua data sesi akan dihapus dan Anda perlu menambahkan akun lagi untuk menggunakannya.', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Ya, Hapus Akun', callback_data: `confirm_delete:${sessionId}` }],
        [{ text: '❌ Batalkan', callback_data: `account:${sessionId}` }]
      ]
    }
  });
}

/**
 * Menangani konfirmasi logout akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleConfirmLogout(bot, chatId, messageId, sessionId) {
  const session = getWhatsAppSession(sessionId);
  
  if (!session) {
    await bot.editMessageText('❌ *AKUN TIDAK DITEMUKAN*\n\nAkun WhatsApp yang Anda pilih tidak ditemukan.', {
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
    // Proses logout
    await bot.editMessageText('⏳ *PROSES LOGOUT*\n\nSedang melakukan logout dari WhatsApp...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    // Pastikan session.sock ada dan memiliki metode logout
    if (session.sock && typeof session.sock.logout === 'function') {
      try {
        await session.sock.logout();
        
        // Hapus session dari daftar
        delete getWhatsAppSessions()[sessionId];
        
        await bot.editMessageText('✅ *BERHASIL LOGOUT*\n\nAkun WhatsApp berhasil logout.', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
            ]
          }
        });
      } catch (error) {
        console.error(`[ERROR] Gagal logout: ${error.message}`);
        throw error;
      }
    } else {
      // Alternatif bila metode logout tidak tersedia
      // Hapus session dari daftar
      delete getWhatsAppSessions()[sessionId];
      
      await bot.editMessageText('✅ *BERHASIL LOGOUT*\n\nAkun WhatsApp berhasil dihapus dari sesi aktif.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat logout: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
}

/**
 * Menangani konfirmasi hapus akun WhatsApp
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {string} sessionId - ID session WhatsApp
 */
async function handleConfirmDelete(bot, chatId, messageId, sessionId) {
  const session = getWhatsAppSession(sessionId);
  
  if (!session) {
    await bot.editMessageText('❌ *AKUN TIDAK DITEMUKAN*\n\nAkun WhatsApp yang Anda pilih tidak ditemukan.', {
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
    // Proses hapus akun
    await bot.editMessageText('⏳ *PROSES HAPUS AKUN*\n\nSedang menghapus akun WhatsApp dari bot...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    // Pastikan session.sock ada dan memiliki metode logout/close
    if (session.sock) {
      try {
        // Coba logout jika metode tersedia
        if (typeof session.sock.logout === 'function') {
          await session.sock.logout();
        } 
        // Atau tutup koneksi jika metode tersedia
        else if (typeof session.sock.close === 'function') {
          await session.sock.close();
        }
      } catch (err) {
        console.error(`[ERROR] Gagal menutup koneksi WhatsApp: ${err.message}`);
        // Lanjutkan proses penghapusan meskipun logout/close gagal
      }
    }
    
    // Hapus session dari daftar
    delete getWhatsAppSessions()[sessionId];
    
    // Hapus folder sesi jika ada
    const sessionDir = path.join(config.SESSIONS_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        // Hapus semua file di dalam direktori
        const files = fs.readdirSync(sessionDir);
        for (const file of files) {
          fs.unlinkSync(path.join(sessionDir, file));
        }
        // Hapus direktori
        fs.rmdirSync(sessionDir);
      } catch (err) {
        console.error(`[ERROR] Gagal menghapus folder sesi: ${err.message}`);
        // Lanjutkan meskipun penghapusan file gagal
      }
    }
    
    await bot.editMessageText('✅ *BERHASIL DIHAPUS*\n\nAkun WhatsApp berhasil dihapus dari bot.', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  } catch (error) {
    await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat menghapus akun: ${error.message}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
}

module.exports = {
  handleAddAccount,
  handleConnectWithQR,
  handleCancelAddAccount,
  handleManageAccounts,
  handleSelectAccount,
  generateAccountMenu,
  handleAccountSettings,
  handleLogoutAccount,
  handleDeleteAccount,
  handleConfirmLogout,
  handleConfirmDelete
};
