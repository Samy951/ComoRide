import { MockWhatsAppService } from './mock-whatsapp';
import { SessionManager } from '../../src/bot/states/session.manager';
import { MessageHandler } from '../../src/bot/handlers/message.handler';
import { ConversationState } from '../../src/bot/states/state.types';
import prisma from '../../src/config/database';

// Mock the services that the bot depends on
jest.mock('../../src/services/auth.service', () => ({
  authService: {
    authenticateByPhone: jest.fn(),
    createCustomer: jest.fn()
  }
}));

jest.mock('../../src/services/booking.service', () => ({
  bookingService: {
    createBooking: jest.fn(),
    getCustomerTrips: jest.fn()
  }
}));

describe('WhatsApp Bot Flows', () => {
  let mockWhatsApp: MockWhatsAppService;
  let messageHandler: MessageHandler;
  let sessionManager: SessionManager;
  
  const testPhoneNumber = '+269XXXXX01@c.us';
  const testCustomer = {
    id: 'test-customer-id',
    name: 'Test User',
    phoneNumber: '+269XXXXX01'
  };

  beforeEach(async () => {
    // Clear database
    await prisma.userSession.deleteMany();
    
    // Initialize mock services
    mockWhatsApp = new MockWhatsAppService();
    await mockWhatsApp.initialize();
    
    // Initialize bot components with mock
    sessionManager = SessionManager.getInstance();
    messageHandler = new MessageHandler(mockWhatsApp as any);
    
    // Clear mock history
    mockWhatsApp.clearHistory();
  });

  afterEach(async () => {
    await prisma.userSession.deleteMany();
    await mockWhatsApp.disconnect();
  });

  describe('Main Menu Flow', () => {
    test('should show welcome menu for new user', async () => {
      // Simulate first message
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'hello');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBe(1);
      
      const welcomeMessage = sentMessages[0].body;
      expect(welcomeMessage).toContain('Como Ride - Transport Sûr');
      expect(welcomeMessage).toContain('Choisissez une option');
      expect(welcomeMessage).toContain('1* - Nouvelle réservation');
      expect(welcomeMessage).toContain('2* - Mes trajets récents');
      expect(welcomeMessage).toContain('3* - Aide & Contact');
    });

    test('should handle menu option 1 (booking)', async () => {
      // Start conversation
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'hello');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Select booking option
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const lastMessage = sentMessages[sentMessages.length - 1];
      
      expect(lastMessage.body).toContain('Nouvelle Réservation');
      expect(lastMessage.body).toContain('D\'où partons-nous');
      expect(lastMessage.body).toContain('adresse de départ');
      
      // Check session state
      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_START);
    });

    test('should handle menu option 2 (history)', async () => {
      // Start conversation and select history
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '2');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.HISTORY_VIEW);
    });

    test('should handle menu option 3 (help)', async () => {
      // Start conversation and select help
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '3');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const lastMessage = sentMessages[sentMessages.length - 1];
      
      expect(lastMessage.body).toContain('Aide Como Ride');
      expect(lastMessage.body).toContain('Comment réserver');
      
      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.HELP_MODE);
    });

    test('should handle invalid menu input', async () => {
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'invalid input');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const lastMessage = sentMessages[sentMessages.length - 1];
      
      expect(lastMessage.body).toContain('Option non reconnue');
    });
  });

  describe('Booking Flow', () => {
    beforeEach(async () => {
      // Mock auth service to return test customer
      const { authService } = require('../../src/services/auth.service');
      authService.authenticateByPhone.mockResolvedValue(null);
      authService.createCustomer.mockResolvedValue(testCustomer);
    });

    test('should complete full booking flow', async () => {
      // Start booking flow
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Enter pickup address
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'Moroni Centre');
      await new Promise(resolve => setTimeout(resolve, 50));

      let session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_DROP);
      expect(session.conversationData.pickupAddress).toBe('Moroni Centre');

      // Enter drop address
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'Aéroport Prince Said Ibrahim');
      await new Promise(resolve => setTimeout(resolve, 50));

      session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_TIME);
      expect(session.conversationData.dropAddress).toBe('Aéroport Prince Said Ibrahim');

      // Select time option
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1'); // Now
      await new Promise(resolve => setTimeout(resolve, 50));

      session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_CONFIRM);
      expect(session.conversationData.pickupTime).toBeDefined();

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const confirmMessage = sentMessages[sentMessages.length - 1];
      expect(confirmMessage.body).toContain('Résumé de votre réservation');
      expect(confirmMessage.body).toContain('Moroni Centre');
      expect(confirmMessage.body).toContain('Aéroport Prince Said Ibrahim');
    });

    test('should validate pickup address', async () => {
      // Start booking flow
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Enter invalid pickup address (too short)
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'abc');
      await new Promise(resolve => setTimeout(resolve, 50));

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const errorMessage = sentMessages[sentMessages.length - 1];
      expect(errorMessage.body).toContain('Adresse invalide');
      expect(errorMessage.body).toContain('au moins 5 caractères');

      // Session should remain in BOOKING_START state
      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_START);
    });

    test('should handle booking confirmation', async () => {
      const { bookingService } = require('../../src/services/booking.service');
      const mockBooking = {
        id: 'booking-123',
        customerId: testCustomer.id,
        pickupAddress: 'Moroni Centre',
        dropAddress: 'Aéroport',
        status: 'PENDING'
      };
      bookingService.createBooking.mockResolvedValue(mockBooking);

      // Set up session in confirmation state
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_CONFIRM);
      await sessionManager.setConversationData('+269XXXXX01', {
        pickupAddress: 'Moroni Centre',
        dropAddress: 'Aéroport Prince Said Ibrahim',
        pickupTime: new Date(),
        estimatedFare: 2000
      });

      // Confirm booking
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 100));

      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.BOOKING_WAITING);
      expect(session.conversationData.currentBookingId).toBe(mockBooking.id);

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const waitingMessage = sentMessages[sentMessages.length - 1];
      expect(waitingMessage.body).toContain('Recherche d\'un chauffeur');
    });

    test('should handle booking cancellation', async () => {
      // Set up session in confirmation state
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_CONFIRM);
      await sessionManager.setConversationData('+269XXXXX01', {
        pickupAddress: 'Moroni Centre',
        dropAddress: 'Aéroport'
      });

      // Cancel booking
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '0');
      await new Promise(resolve => setTimeout(resolve, 50));

      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.MENU);

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const cancelMessage = sentMessages[sentMessages.length - 1];
      expect(cancelMessage.body).toContain('Réservation annulée');
    });
  });

  describe('History Flow', () => {
    test('should show empty history for new user', async () => {
      const { authService } = require('../../src/services/auth.service');
      authService.authenticateByPhone.mockResolvedValue(null);

      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '2');
      await new Promise(resolve => setTimeout(resolve, 50));

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const historyMessage = sentMessages[sentMessages.length - 1];
      expect(historyMessage.body).toContain('Aucun historique trouvé');
      expect(historyMessage.body).toContain('première réservation');
    });

    test('should show trip history for existing customer', async () => {
      const { authService, bookingService } = require('../../src/services/auth.service');
      const mockTrips = [
        {
          id: 'trip-1',
          fare: 2000,
          createdAt: new Date(),
          driver: { name: 'Ahmed Mohamed' },
          driverRating: 4.8,
          booking: {
            pickupAddress: 'Moroni Centre',
            dropAddress: 'Aéroport'
          }
        }
      ];

      authService.authenticateByPhone.mockResolvedValue(testCustomer);
      bookingService.getCustomerTrips = jest.fn().mockResolvedValue(mockTrips);

      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '2');
      await new Promise(resolve => setTimeout(resolve, 50));

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const historyMessage = sentMessages[sentMessages.length - 1];
      expect(historyMessage.body).toContain('Vos trajets récents');
      expect(historyMessage.body).toContain('Ahmed Mohamed');
      expect(historyMessage.body).toContain('2000 KMF');
    });
  });

  describe('Global Commands', () => {
    test('should handle MENU command from any state', async () => {
      // Start in booking state
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_DROP);
      
      // Send MENU command
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'MENU');
      await new Promise(resolve => setTimeout(resolve, 50));

      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.MENU);

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const menuMessage = sentMessages[sentMessages.length - 1];
      expect(menuMessage.body).toContain('Como Ride - Transport Sûr');
    });

    test('should handle AIDE command from any state', async () => {
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'AIDE');
      await new Promise(resolve => setTimeout(resolve, 50));

      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.HELP_MODE);

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const helpMessage = sentMessages[sentMessages.length - 1];
      expect(helpMessage.body).toContain('Aide Como Ride');
    });

    test('should handle ANNULER command', async () => {
      // Start in booking state
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_DROP);
      
      // Send cancel command
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'ANNULER');
      await new Promise(resolve => setTimeout(resolve, 50));

      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.currentState).toBe(ConversationState.MENU);
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      const { authService } = require('../../src/services/auth.service');
      authService.createCustomer.mockRejectedValue(new Error('Service unavailable'));

      // Try to start booking (which will trigger customer creation)
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_CONFIRM);
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 100));

      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      const errorMessage = sentMessages[sentMessages.length - 1];
      expect(errorMessage.body).toContain('Problème technique temporaire');
    });

    test('should reset session on critical errors', async () => {
      // Set up a state that might cause errors
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_CONFIRM);
      
      // Simulate error condition
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'invalid confirmation');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Session should be preserved but user should get helpful message
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Session Management', () => {
    test('should persist session data between messages', async () => {
      // Start booking and set pickup
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, '1');
      await new Promise(resolve => setTimeout(resolve, 50));
      
      mockWhatsApp.simulateIncomingMessage(testPhoneNumber, 'Moroni Centre');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check session persistence
      const session = await sessionManager.getSession('+269XXXXX01');
      expect(session.conversationData.pickupAddress).toBe('Moroni Centre');
      expect(session.currentState).toBe(ConversationState.BOOKING_DROP);
    });

    test('should handle multiple concurrent users', async () => {
      const user1 = '+269XXXXX01@c.us';
      const user2 = '+269XXXXX02@c.us';

      // Both users start booking
      mockWhatsApp.simulateIncomingMessage(user1, '1');
      mockWhatsApp.simulateIncomingMessage(user2, '1');
      await new Promise(resolve => setTimeout(resolve, 50));

      // User 1 sets pickup
      mockWhatsApp.simulateIncomingMessage(user1, 'Moroni Centre');
      await new Promise(resolve => setTimeout(resolve, 50));

      // User 2 sets different pickup
      mockWhatsApp.simulateIncomingMessage(user2, 'Mutsamudu Centre');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check sessions are separate
      const session1 = await sessionManager.getSession('+269XXXXX01');
      const session2 = await sessionManager.getSession('+269XXXXX02');

      expect(session1.conversationData.pickupAddress).toBe('Moroni Centre');
      expect(session2.conversationData.pickupAddress).toBe('Mutsamudu Centre');
    });
  });
});