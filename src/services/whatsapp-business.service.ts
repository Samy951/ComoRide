import logger from '../config/logger';

// Service pour WhatsApp Business API (Twilio)
// Note: Nécessite l'installation de 'twilio' pour fonctionner
export class WhatsAppBusinessService {
  private client: any;
  private whatsappNumber: string;

  constructor() {
    // Vérification conditionnelle pour éviter les erreurs de compilation
    try {
      const twilio = require('twilio');
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } catch (error) {
      logger.warn('Twilio not installed - WhatsApp Business service disabled');
      this.client = null;
    }
    this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';
  }

  async sendMessage(to: string, message: string) {
    if (!this.client) {
      throw new Error('WhatsApp Business service not available - Twilio not configured');
    }
    
    try {
      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${to}`,
        body: message
      });
      
      logger.info('WhatsApp Business message sent', {
        messageId: result.sid,
        to
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send WhatsApp Business message', error);
      throw error;
    }
  }

  async sendTemplate(to: string, templateName: string, params: string[]) {
    if (!this.client) {
      throw new Error('WhatsApp Business service not available - Twilio not configured');
    }
    
    try {
      // Pour les messages templates approuvés par WhatsApp
      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${to}`,
        contentSid: templateName, // Template ID approuvé
        contentVariables: JSON.stringify(params)
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send template message', error);
      throw error;
    }
  }

  async sendLocation(to: string, latitude: number, longitude: number, name: string) {
    if (!this.client) {
      throw new Error('WhatsApp Business service not available - Twilio not configured');
    }
    
    try {
      const result = await this.client.messages.create({
        from: this.whatsappNumber,
        to: `whatsapp:${to}`,
        body: name,
        persistentAction: [`geo:${latitude},${longitude}`]
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send location', error);
      throw error;
    }
  }

  // Webhook handler pour recevoir les messages
  async handleIncomingMessage(body: any) {
    const { From, Body, MessageSid } = body;
    
    logger.info('WhatsApp Business message received', {
      from: From,
      messageId: MessageSid,
      body: Body
    });
    
    // Traiter le message ici
    return {
      from: From.replace('whatsapp:', ''),
      message: Body,
      messageId: MessageSid
    };
  }
}