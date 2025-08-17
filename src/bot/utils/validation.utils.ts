export class ValidationUtils {
  static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    const trimmed = address.trim();
    return trimmed.length >= 5 && trimmed.length <= 200;
  }

  static isValidPassengerCount(count: string): boolean {
    const num = parseInt(count);
    return !isNaN(num) && num >= 1 && num <= 8;
  }

  static isMenuOption(input: string): boolean {
    const trimmed = input.trim();
    return /^[0-9]$/.test(trimmed);
  }

  static parseMenuOption(input: string): number | null {
    const trimmed = input.trim();
    const num = parseInt(trimmed);
    return !isNaN(num) ? num : null;
  }

  static isTimeOption(input: string): boolean {
    const trimmed = input.trim();
    return /^[1-4]$/.test(trimmed);
  }

  static parseCustomTime(input: string): Date | null {
    const trimmed = input.trim().toLowerCase();
    
    // Handle relative times in French
    const now = new Date();
    
    if (trimmed.includes('heure')) {
      const hourMatch = trimmed.match(/(\d+)\s*heure?s?/);
      if (hourMatch) {
        const hours = parseInt(hourMatch[1]);
        if (hours >= 1 && hours <= 24) {
          return new Date(now.getTime() + hours * 60 * 60 * 1000);
        }
      }
    }
    
    if (trimmed.includes('minute')) {
      const minuteMatch = trimmed.match(/(\d+)\s*minute?s?/);
      if (minuteMatch) {
        const minutes = parseInt(minuteMatch[1]);
        if (minutes >= 15 && minutes <= 1440) { // 15 min to 24h
          return new Date(now.getTime() + minutes * 60 * 1000);
        }
      }
    }
    
    // Handle specific times like "14h30", "14:30"
    const timeMatch = trimmed.match(/(\d{1,2})[h:](\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        const targetTime = new Date();
        targetTime.setHours(hour, minute, 0, 0);
        
        // If time is in the past, add one day
        if (targetTime < now) {
          targetTime.setDate(targetTime.getDate() + 1);
        }
        
        return targetTime;
      }
    }
    
    return null;
  }

  static getTimeFromOption(option: number): Date {
    const now = new Date();
    
    switch (option) {
      case 1: // Maintenant
        return now;
      case 2: // Dans 30 minutes
        return new Date(now.getTime() + 30 * 60 * 1000);
      case 3: // Dans 1 heure
        return new Date(now.getTime() + 60 * 60 * 1000);
      default:
        return now;
    }
  }

  static isConfirmOption(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['1', 'oui', 'ok', 'confirmer', 'valider'].includes(trimmed);
  }

  static isCancelOption(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['0', 'annuler', 'cancel', 'stop', 'arreter'].includes(trimmed);
  }

  static isMenuCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['menu', 'accueil', 'retour'].includes(trimmed);
  }

  static isHelpCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['aide', 'help', '?', 'info'].includes(trimmed);
  }

  static isContinueCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['continuer', 'continue', 'reprendre', 'resume'].includes(trimmed);
  }

  static sanitizeAddress(address: string): string {
    return address.trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[<>]/g, '') // Remove potential HTML chars
      .substring(0, 200); // Limit length
  }

  static formatTimeInput(input: string): string {
    return input.trim()
      .replace(/\s+/g, ' ')
      .substring(0, 50);
  }

  static isValidBookingModification(input: string): boolean {
    const trimmed = input.trim();
    return /^[1-4]$/.test(trimmed);
  }

  static extractZoneFromAddress(address: string): string | null {
    const normalizedAddress = address.toLowerCase();
    
    const zones = [
      'moroni',
      'mutsamudu',
      'fomboni',
      'domoni',
      'sima',
      'moya',
      'ouani',
      'aéroport',
      'airport'
    ];
    
    for (const zone of zones) {
      if (normalizedAddress.includes(zone)) {
        return zone.charAt(0).toUpperCase() + zone.slice(1);
      }
    }
    
    return null;
  }
}