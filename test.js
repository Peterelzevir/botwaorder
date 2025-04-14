import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Menggunakan WA v${version.join('.')}, terbaru: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu('My App'),
    printQRInTerminal: false
  });

  if (!sock.authState.creds.registered) {
    const phoneNumber = await question('Masukkan nomor WhatsApp Anda (dengan kode negara, tanpa tanda +): ');
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`Kode pairing: ${code}`);
  }

  sock.ev.on('creds.update', saveCreds);
}

start();
