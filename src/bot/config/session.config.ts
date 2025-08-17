export const sessionConfig = {
  // Cache settings
  cacheSync: 30000, // 30 seconds
  cachePurge: 3600000, // 1 hour for inactive sessions
  
  // Backup settings
  backupInterval: 21600000, // 6 hours
  
  // Session limits
  maxConcurrentSessions: 100,
  sessionCleanupInterval: 300000, // 5 minutes
  
  // Default conversation data structure
  defaultConversationData: {
    pickupAddress: null,
    dropAddress: null,
    pickupTime: null,
    passengers: 1,
    estimatedFare: null,
    currentBookingId: null,
    retryCount: 0
  }
};