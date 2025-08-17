/**
 * Validation utilities for Como Ride platform
 * Handles Comorian-specific validations (phone numbers, coordinates, etc.)
 */

/**
 * Validates Comorian phone number format
 * Expected format: +269XXXXXXX (7 digits after +269)
 * 
 * @param phone - Phone number to validate
 * @returns true if valid Comorian phone number
 * 
 * @example
 * validateComorianPhone("+2693321234") // true
 * validateComorianPhone("+33123456789") // false
 * validateComorianPhone("2693321234") // false
 */
export function validateComorianPhone(phone: string): boolean {
  const comorianPhoneRegex = /^\+269\d{7}$/;
  return comorianPhoneRegex.test(phone);
}

/**
 * Validates GPS coordinates within Comoros archipelago bounds
 * Comoros approximate bounds:
 * - Latitude: -12.8 to -11.3
 * - Longitude: 43.0 to 44.8
 * 
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns true if coordinates are within Comoros bounds
 * 
 * @example
 * validateCoordinates(-11.7, 43.3) // true (Moroni area)
 * validateCoordinates(0, 0) // false (not in Comoros)
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  const COMOROS_BOUNDS = {
    latMin: -12.8,
    latMax: -11.3,
    lngMin: 43.0,
    lngMax: 44.8
  };

  return (
    lat >= COMOROS_BOUNDS.latMin &&
    lat <= COMOROS_BOUNDS.latMax &&
    lng >= COMOROS_BOUNDS.lngMin &&
    lng <= COMOROS_BOUNDS.lngMax
  );
}

/**
 * Calculates estimated fare based on distance
 * Basic tarification: 200 KMF base + 150 KMF per km
 * 
 * @param distance - Distance in kilometers
 * @returns Estimated fare in Comorian Francs (KMF)
 * 
 * @example
 * calculateEstimatedFare(5) // 950 KMF (200 base + 5*150)
 * calculateEstimatedFare(0) // 200 KMF (minimum fare)
 */
export function calculateEstimatedFare(distance: number): number {
  if (distance < 0) {
    throw new Error('Distance cannot be negative');
  }

  const BASE_FARE = 200; // KMF
  const RATE_PER_KM = 150; // KMF per km
  
  return BASE_FARE + (distance * RATE_PER_KM);
}

/**
 * Calculates distance between two GPS points using Haversine formula
 * 
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Validates Comorian zones
 * Supported zones for Como Ride service
 */
export const SUPPORTED_ZONES = [
  'Moroni',
  'Mutsamudu',
  'Fomboni',
  'Iconi',
  'Mitsamiouli',
  'Mbeni',
  'Foumbouni'
] as const;

export type SupportedZone = typeof SUPPORTED_ZONES[number];

/**
 * Validates if a zone is supported
 * 
 * @param zone - Zone name to validate
 * @returns true if zone is supported
 */
export function validateZone(zone: string): zone is SupportedZone {
  return SUPPORTED_ZONES.includes(zone as SupportedZone);
}

/**
 * Masks phone number for logging (GDPR compliance)
 * Shows only country code and last 2 digits
 * 
 * @param phone - Phone number to mask
 * @returns Masked phone number
 * 
 * @example
 * maskPhoneNumber("+2693321234") // "+269*****34"
 */
export function maskPhoneNumber(phone: string): string {
  if (phone.length <= 6) return '***';
  
  const countryCode = phone.slice(0, 4); // +269 or +33 etc
  const lastDigits = phone.slice(-2);
  const middleLength = phone.length - 6; // Total - country code - last 2 digits
  const maskedMiddle = '*'.repeat(middleLength);
  
  return `${countryCode}${maskedMiddle}${lastDigits}`;
}