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

  // Driver-specific validations
  static isYesOption(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['oui', 'yes', 'y', 'o', '1', 'accepter', 'ok'].includes(trimmed);
  }

  static isNoOption(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['non', 'no', 'n', '2', 'refuser', 'refus'].includes(trimmed);
  }

  static isDriverCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    const driverCommands = [
      'disponible', 'dispo', 'occupé', 'busy',
      'courses', 'mes courses', 'trajets',
      'client', 'mode client', 'réserver',
      'chauffeur', 'driver'
    ];
    
    return driverCommands.some(cmd => trimmed.includes(cmd));
  }

  static isAvailabilityCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    return ['disponible', 'dispo', 'occupé', 'busy', 'libre', 'pas libre'].includes(trimmed);
  }

  static parseAvailabilityCommand(input: string): boolean | null {
    const trimmed = input.trim().toLowerCase();
    
    if (['disponible', 'dispo', 'libre'].includes(trimmed)) {
      return true;
    }
    
    if (['occupé', 'busy', 'pas libre'].includes(trimmed)) {
      return false;
    }
    
    return null;
  }

  static isValidDriverMenuOption(input: string): boolean {
    const trimmed = input.trim();
    return /^[0-9]$/.test(trimmed) && ['0', '1', '2', '3', '4', '5', '9'].includes(trimmed);
  }

  static isValidPhoneNumber(phoneNumber: string): boolean {
    // TODO: PRODUCTION - Remove French numbers support and keep only Comoros
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // TEMPORARY: Accept French numbers for testing (+33...)
    if (cleaned.startsWith('33')) {
      return /^33[0-9]{9}$/.test(cleaned);
    }
    
    // Comoros numbers are typically +269 followed by 7 digits
    // Also accept local format with 7 digits
    return /^(269)?[0-9]{7}$/.test(cleaned);
  }
}