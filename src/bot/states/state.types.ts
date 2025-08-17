export enum ConversationState {
  MENU = 'MENU',
  BOOKING_START = 'BOOKING_START',
  BOOKING_PICKUP = 'BOOKING_PICKUP',
  BOOKING_DROP = 'BOOKING_DROP',
  BOOKING_TIME = 'BOOKING_TIME',
  BOOKING_CONFIRM = 'BOOKING_CONFIRM',
  BOOKING_WAITING = 'BOOKING_WAITING',
  HISTORY_VIEW = 'HISTORY_VIEW',
  HELP_MODE = 'HELP_MODE',
  // Driver states
  DRIVER_MENU = 'DRIVER_MENU',
  DRIVER_AVAILABILITY = 'DRIVER_AVAILABILITY',
  DRIVER_BOOKING_NOTIFY = 'DRIVER_BOOKING_NOTIFY',
  DRIVER_BOOKING_ACCEPT = 'DRIVER_BOOKING_ACCEPT',
  DRIVER_TRIP_STATUS = 'DRIVER_TRIP_STATUS'
}

export interface ConversationData {
  pickupAddress?: string | null;
  dropAddress?: string | null;
  pickupTime?: Date | null;
  passengers?: number;
  estimatedFare?: number | null;
  currentBookingId?: string | null;
  retryCount?: number;
  lastActionAt?: Date;
  // Driver specific data
  isDriverMode?: boolean;
  currentBookingNotification?: string | null;
  bookingNotificationTimeout?: Date | null;
  availabilityToggleCount?: number;
  temporaryClientMode?: boolean;
  [key: string]: any;
}

export interface UserSessionData {
  id: string;
  phoneNumber: string;
  currentState: ConversationState;
  conversationData: ConversationData;
  lastMessageAt: Date;
  timeoutCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeoutEvent {
  phoneNumber: string;
  type: 'WARNING' | 'RESET' | 'CLEANUP';
  scheduledAt: Date;
}

export interface WhatsAppMessage {
  from: string;
  body: string;
  timestamp: number;
  type: string;
}