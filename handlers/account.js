/**
 * Handler untuk manajemen akun WhatsApp
 */
const fs = require('fs');
const { generateMainMenu } = require('./menu');
const {
  initializeWhatsApp,
  connectWithPairingCode,
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
  userStates[chatId] = { state: 'adding_account' };
  
  await bot.editMessageText('🔄 *TAMBAH AKUN WHATSAPP*\n\nPilih metode koneksi:', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📱 Koneksi dengan QR Code', callback_data: 'connect_qr' }],
        [{ text: '🔢 Koneksi dengan Pairing Code', callback_data: 'connect_pairing' }],
        [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
      ]
    }
  });
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
            
            // Hapus pesan status sebelumnya
            try {
              await bot.deleteMessage(chatId, statusMessage.message_id);
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
            userStates[chatId].qrMessageId = msg.message_id;
            
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
                  [{ text: '🔄 Coba Lagi', callback_data: 'connect_qr' }],
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
          userStates[chatId] = { state: 'idle' };
          
          // Hapus pesan QR code jika masih ada
          if (userStates[chatId]?.qrMessageId) {
            try {
              await bot.deleteMessage(chatId, userStates[chatId].qrMessageId);
            } catch (err) {
              console.error('[ERROR] Gagal menghapus pesan QR:', err);
            }
          }
          
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
            reply_markup: generateMainMenu()
          });
        } else if (status === 'error') {
          userStates[chatId] = { state: 'idle' };
          
          // Kirim pesan error dengan detail
          await bot.sendMessage(chatId, `❌ *ERROR*\n\nTerjadi kesalahan: ${data || 'Unknown error'}`, {
            parse_mode: 'Markdown',
            reply_markup: generateMainMenu()
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
      reply_markup: generateMainMenu()
    });
  }
}

/**
 * Menangani koneksi dengan pairing code
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {Object} userStates - Objek state pengguna
 */
async function handleConnectWithPairing(bot, chatId, messageId, userStates) {
  userStates[chatId] = { 
    state: 'waiting_phone_number'
  };

  await bot.editMessageText('📞 *KONEKSI DENGAN PAIRING CODE*\n\nMasukkan nomor telepon WhatsApp Anda dengan format internasional (contoh: 628123456789):', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
      ]
    }
  });

  // Listener untuk nomor telepon
  bot.once('message', async (msg) => {
    if (msg.chat.id !== chatId || userStates[chatId]?.state !== 'waiting_phone_number') {
      return;
    }

    const phoneNumber = msg.text.trim();
    
    // Validasi format nomor telepon
    if (!/^[0-9]{10,15}$/.test(phoneNumber.replace(/[^0-9]/g, ''))) {
      await bot.sendMessage(chatId, '❌ *FORMAT SALAH*\n\nFormat nomor telepon tidak valid. Gunakan format internasional tanpa tanda + (contoh: 628123456789).', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Coba Lagi', callback_data: 'connect_pairing' }],
            [{ text: '❌ Batal', callback_data: 'back_to_main' }]
          ]
        }
      });
      return;
    }

    const sessionId = `session_${Date.now()}`;
    userStates[chatId] = { 
      state: 'waiting_pairing_code',
      sessionId
    };

    // Hapus pesan nomor telepon untuk keamanan
    try {
      await bot.deleteMessage(chatId, msg.message_id);
    } catch (err) {
      console.error('[ERROR] Gagal menghapus pesan nomor telepon:', err);
    }

    const statusMsg = await bot.sendMessage(chatId, '⏳ *MENGHUBUNGKAN KE WHATSAPP*\n\nMempersiapkan koneksi dengan pairing code...', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
        ]
      }
    });

    try {
      // Koneksi dengan pairing code menggunakan implementasi terbaru
      connectWithPairingCode(
        sessionId, 
        phoneNumber,
        async (status, data) => {
          if (status === 'pairing_code') {
            await bot.editMessageText(`📲 *KODE PAIRING*\n\nMasukkan kode ini di WhatsApp Anda:\n\n*${data}*\n\nBuka WhatsApp > Menu > Perangkat Tertaut > Tautkan Perangkat > Masukkan kode`, {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '❌ Batal', callback_data: 'cancel_add_account' }]
                ]
              }
            });
          } 
          else if (status === 'connected') {
            userStates[chatId] = { state: 'idle' };
            
            await bot.editMessageText('✅ *BERHASIL TERHUBUNG*\n\nAkun WhatsApp berhasil terhubung! Anda sekarang dapat menggunakan fitur-fitur bot.', {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📱 Kelola Akun Ini', callback_data: `account:${sessionId}` }],
                  [{ text: '🔙 Kembali ke Menu Utama', callback_data: 'back_to_main' }]
                ]
              }
            });
          } 
          else if (status === 'disconnected') {
            userStates[chatId] = { state: 'idle' };
            
            await bot.editMessageText('❌ *KONEKSI TERPUTUS*\n\nKoneksi WhatsApp terputus. Silakan coba lagi.', {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'Markdown',
              reply_markup: generateMainMenu()
            });
          }
          else if (status === 'error') {
            userStates[chatId] = { state: 'idle' };
            
            await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan: ${data}`, {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'Markdown',
              reply_markup: generateMainMenu()
            });
          }
        }
      );
    } catch (error) {
      userStates[chatId] = { state: 'idle' };
      
      await bot.editMessageText(`❌ *ERROR*\n\nTerjadi kesalahan saat menghubungkan ke WhatsApp: ${error.message}`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        reply_markup: generateMainMenu()
      });
    }
  });
}

/**
 * Menangani pembatalan penambahan akun
 * @param {Object} bot - Instance bot Telegram
 * @param {number} chatId - ID chat Telegram
 * @param {number} messageId - ID pesan Telegram
 * @param {Object} userStates - Objek state pengguna
 */
async function handleCancelAddAccount(bot, chatId, messageId, userStates) {
  userStates[chatId] = { state: 'idle' };
  
  await bot.editMessageText('⚠️ *DIBATALKAN*\n\nPenambahan akun WhatsApp dibatalkan.', {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: generateMainMenu()
  });
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
      reply_markup: generateMainMenu()
    });
    return;
  }

  const keyboard = sessionIds.map(id => {
    const session = sessions[id];
    const status = session.connected ? '🟢' : '🔴';
    return [{ text: `${status} Session ${id.split('_')[1]}`, callback_data: `account:${id}` }];
  });

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

  const status = session.connected ? '🟢 Terhubung' : '🔴 Terputus';
  
  await bot.editMessageText(`📱 *DETAIL AKUN WHATSAPP*\n\nID: ${sessionId}\nStatus: ${status}\n\nPilih tindakan:`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: generateAccountMenu(sessionId)
  });
}

module.exports = {
  handleAddAccount,
  handleConnectWithQR,
  handleConnectWithPairing,
  handleCancelAddAccount,
  handleManageAccounts,
  handleSelectAccount,
  generateAccountMenu
};
