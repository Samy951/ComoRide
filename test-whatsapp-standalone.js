const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('🔄 Test WhatsApp connection standalone...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'test-' + Date.now()
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔗 TEST WHATSAPP QR CODE');
    console.log('='.repeat(60));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(60));
    console.log('📱 Scannez avec WhatsApp pour tester');
    console.log('='.repeat(60) + '\n');
});

client.on('ready', () => {
    console.log('✅ WhatsApp connected successfully!');
    console.log('🎯 Test réussi - Como Ride bot devrait fonctionner');
    process.exit(0);
});

client.on('auth_failure', (msg) => {
    console.log('❌ Auth failure:', msg);
    process.exit(1);
});

console.log('⏳ Initializing WhatsApp client...');
client.initialize();