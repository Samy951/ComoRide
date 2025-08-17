export class PhoneUtils {
  static normalizePhoneNumber(phoneNumber: string): string {
    // Remove WhatsApp suffix @c.us if present
    let cleaned = phoneNumber.replace('@c.us', '');
    
    // Remove all non-digit characters
    cleaned = cleaned.replace(/\D/g, '');
    
    // Handle French numbers for testing (33...)
    if (cleaned.startsWith('33')) {
      return `+${cleaned}`;
    }
    
    // Handle Comoros country code
    if (cleaned.startsWith('269')) {
      return `+${cleaned}`;
    }
    
    // Add Comoros country code if missing
    if (cleaned.length === 7 && /^[37]/.test(cleaned)) {
      return `+269${cleaned}`;
    }
    
    // Return with + if it looks like an international number
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  }

  static formatForDisplay(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    if (normalized.startsWith('+269')) {
      const number = normalized.substring(4);
      return `+269 ${number.substring(0, 1)} ${number.substring(1, 3)} ${number.substring(3, 5)} ${number.substring(5)}`;
    }
    
    return normalized;
  }

  static maskPhoneNumber(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    if (normalized.length > 4) {
      return normalized.substring(0, normalized.length - 4) + 'XXXX';
    }
    
    return 'XXXX';
  }

  static isValidComorosNumber(phoneNumber: string): boolean {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    // TODO: PRODUCTION - Remove this French numbers support
    // TEMPORARY: Accept French numbers for testing
    if (normalized.startsWith('+33')) {
      return /^\+33[0-9]{9}$/.test(normalized);
    }
    
    // Comoros numbers: +269 followed by 7 digits starting with 3 or 7
    const comorosPattern = /^\+269[37]\d{6}$/;
    return comorosPattern.test(normalized);
  }

  static extractWhatsAppId(message: any): string {
    if (typeof message.from === 'string') {
      return message.from;
    }
    
    if (message.author) {
      return message.author;
    }
    
    return message.from?._serialized || message.from?.user || '';
  }
}