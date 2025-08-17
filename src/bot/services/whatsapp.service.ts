import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import logger from '../../config/logger';
import { whatsappConfig } from '../config/whatsapp.config';
import { PhoneUtils } from '../utils/phone.utils';

export class WhatsAppService {
  private client!: Client;
  private isReady: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private messageHandlers: ((message: Message) => void)[] = [];
  private readyHandlers: (() => void)[] = [];
  private disconnectedHandlers: ((reason: string) => void)[] = [];

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'como-ride-bot',
        dataPath: whatsappConfig.sessionPath
      }),
      puppeteer: whatsappConfig.clientOptions.puppeteer
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('qr', (qr: string) => {
      logger.info('WhatsApp QR Code generated');
      console.log('\n🔗 WhatsApp QR Code:');
      qrcode.generate(qr, { small: true });
      console.log('\nScan this QR code with your WhatsApp to connect Como Ride bot');
    });

    this.client.on('ready', () => {
      this.isReady = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      logger.info('WhatsApp client is ready!');
      
      // Notify all ready handlers
      this.readyHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          logger.error('Ready handler error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    });

    this.client.on('message', async (message: Message) => {
      try {
        // Skip messages from groups and status updates
        if (message.from.includes('@g.us') || message.from.includes('status@broadcast')) {
          return;
        }

        // Skip messages from self
        if (message.fromMe) {
          return;
        }

        const phoneNumber = PhoneUtils.normalizePhoneNumber(message.from);
        
        logger.info('WhatsApp message received', {
          from: PhoneUtils.maskPhoneNumber(phoneNumber),
          type: message.type,
          messageLength: message.body?.length || 0
        });

        // Notify all message handlers
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            logger.error('Message handler error', {
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        });
      } catch (error) {
        logger.error('Error processing WhatsApp message', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.client.on('disconnected', async (reason: string) => {
      this.isReady = false;
      
      logger.warn('WhatsApp client disconnected', { reason });
      
      // Notify all disconnected handlers
      this.disconnectedHandlers.forEach(handler => {
        try {
          handler(reason);
        } catch (error) {
          logger.error('Disconnected handler error', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Attempt reconnection
      await this.handleReconnection();
    });

    this.client.on('auth_failure', (msg: string) => {
      logger.error('WhatsApp authentication failed', { message: msg });
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp client authenticated');
    });
  }

  async initialize(): Promise<void> {
    if (this.isConnecting || this.isReady) {
      return;
    }

    this.isConnecting = true;
    
    try {
      logger.info('Initializing WhatsApp client...');
      await this.client.initialize();
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to initialize WhatsApp client', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      logger.error('Cannot send message: WhatsApp client not ready');
      return false;
    }

    try {
      // Format phone number for WhatsApp
      const formattedNumber = this.formatPhoneForWhatsApp(phoneNumber);
      
      await this.client.sendMessage(formattedNumber, message);
      
      logger.info('WhatsApp message sent', {
        to: PhoneUtils.maskPhoneNumber(phoneNumber),
        messageLength: message.length
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        to: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return false;
    }
  }

  private formatPhoneForWhatsApp(phoneNumber: string): string {
    const normalized = PhoneUtils.normalizePhoneNumber(phoneNumber);
    
    // Remove + and add @c.us
    const cleaned = normalized.replace('+', '');
    return `${cleaned}@c.us`;
  }

  onMessage(handler: (message: Message) => void): void {
    this.messageHandlers.push(handler);
  }

  onReady(handler: () => void): void {
    if (this.isReady) {
      // Call immediately if already ready
      handler();
    } else {
      this.readyHandlers.push(handler);
    }
  }

  onDisconnected(handler: (reason: string) => void): void {
    this.disconnectedHandlers.push(handler);
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= whatsappConfig.reconnectAttempts) {
      logger.error('Maximum reconnection attempts reached', {
        attempts: this.reconnectAttempts
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    
    logger.info('Attempting to reconnect WhatsApp client', {
      attempt: this.reconnectAttempts,
      delay: `${delay}ms`
    });

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection attempt failed', {
          attempt: this.reconnectAttempts,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, delay);
  }

  isConnected(): boolean {
    return this.isReady;
  }

  async getConnectionState(): Promise<string> {
    if (!this.client) {
      return 'not_initialized';
    }

    try {
      const state = await this.client.getState();
      return state;
    } catch (error) {
      return 'error';
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
        this.isReady = false;
        this.isConnecting = false;
        
        logger.info('WhatsApp client disconnected gracefully');
      } catch (error) {
        logger.error('Error during WhatsApp disconnect', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Method to send typing indicator
  async sendTyping(phoneNumber: string): Promise<void> {
    if (!this.isReady) {
      return;
    }

    try {
      const formattedNumber = this.formatPhoneForWhatsApp(phoneNumber);
      const chat = await this.client.getChatById(formattedNumber);
      await chat.sendStateTyping();
    } catch (error) {
      // Typing indicator is not critical, just log the error
      logger.debug('Failed to send typing indicator', {
        to: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method to clear typing indicator
  async clearTyping(phoneNumber: string): Promise<void> {
    if (!this.isReady) {
      return;
    }

    try {
      const formattedNumber = this.formatPhoneForWhatsApp(phoneNumber);
      const chat = await this.client.getChatById(formattedNumber);
      await chat.clearState();
    } catch (error) {
      // Typing indicator is not critical, just log the error
      logger.debug('Failed to clear typing indicator', {
        to: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get chat history (useful for debugging)
  async getChatHistory(phoneNumber: string, limit: number = 10): Promise<Message[]> {
    if (!this.isReady) {
      return [];
    }

    try {
      const formattedNumber = this.formatPhoneForWhatsApp(phoneNumber);
      const chat = await this.client.getChatById(formattedNumber);
      const messages = await chat.fetchMessages({ limit });
      
      return messages;
    } catch (error) {
      logger.error('Failed to get chat history', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return [];
    }
  }
}