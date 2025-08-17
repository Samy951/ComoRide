export const whatsappConfig = {
  sessionPath: process.env.WHATSAPP_SESSION_PATH || './sessions/whatsapp_session',
  reconnectAttempts: parseInt(process.env.WHATSAPP_RECONNECT_ATTEMPTS || '3'),
  timeoutWarning: parseInt(process.env.WHATSAPP_TIMEOUT_WARNING || '300000'), // 5min
  timeoutReset: parseInt(process.env.WHATSAPP_TIMEOUT_RESET || '900000'), // 15min
  sessionMax: parseInt(process.env.WHATSAPP_SESSION_MAX || '2700000'), // 45min
  
  // Message templates
  welcomeMessage: process.env.BOT_WELCOME_MESSAGE || '🚗 Como Ride - Transport Sûr',
  supportPhone: process.env.BOT_SUPPORT_PHONE || '+269XXXXXXXX',
  
  // WhatsApp client options
  clientOptions: {
    authStrategy: undefined, // Will be set dynamically
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
  }
};