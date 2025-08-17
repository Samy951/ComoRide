import { TimeoutManager } from '../../src/bot/states/timeout.manager';
import { SessionManager } from '../../src/bot/states/session.manager';
import { ConversationState } from '../../src/bot/states/state.types';
import { MockWhatsAppService } from './mock-whatsapp';
import prisma from '../../src/config/database';

// Mock the config values for faster testing
jest.mock('../../src/bot/config/whatsapp.config', () => ({
  whatsappConfig: {
    timeoutWarning: 100, // 100ms for testing
    timeoutReset: 200,   // 200ms for testing
    sessionMax: 300      // 300ms for testing
  }
}));

describe('Timeout Management', () => {
  let timeoutManager: TimeoutManager;
  let sessionManager: SessionManager;
  let mockWhatsApp: MockWhatsAppService;
  
  const testPhoneNumber = '+269XXXXX01';

  beforeEach(async () => {
    // Clear database
    await prisma.userSession.deleteMany();
    
    // Initialize services
    timeoutManager = TimeoutManager.getInstance();
    sessionManager = SessionManager.getInstance();
    mockWhatsApp = new MockWhatsAppService();
    await mockWhatsApp.initialize();
    
    // Set up timeout manager with mock message service
    timeoutManager.setMessageService(mockWhatsApp);
    
    // Clear any existing timeouts
    timeoutManager.clearTimeout(testPhoneNumber);
    
    // Clear mock history
    mockWhatsApp.clearHistory();
  });

  afterEach(async () => {
    await prisma.userSession.deleteMany();
    timeoutManager.clearTimeout(testPhoneNumber);
    await mockWhatsApp.disconnect();
  });

  describe('Timeout Scheduling', () => {
    test('should schedule warning timeout', (done) => {
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      // Verify timeout is scheduled
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).toContain('XXXX'); // Masked phone number
      
      done();
    });

    test('should clear existing timeout when scheduling new one', (done) => {
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      timeoutManager.scheduleTimeout(testPhoneNumber, 'RESET');
      
      // Should only have one timeout
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).toHaveLength(1);
      
      done();
    });

    test('should refresh timeout on user activity', async () => {
      // Create session and set up timeout
      await sessionManager.getSession(testPhoneNumber);
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      // Simulate user activity
      await timeoutManager.handleUserActivity(testPhoneNumber);
      
      // Should have reset timeout count
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(0);
    });
  });

  describe('Warning Timeout', () => {
    test('should send warning message for active conversation', async () => {
      // Set up session in booking state
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_START);
      
      // Schedule and trigger warning timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBeGreaterThan(0);
      
      const warningMessage = sentMessages[sentMessages.length - 1];
      expect(warningMessage.body).toContain('Toujours là');
      expect(warningMessage.body).toContain('réservation est en attente');
    });

    test('should not send warning for menu state', async () => {
      // Set up session in menu state
      await sessionManager.setState(testPhoneNumber, ConversationState.MENU);
      
      // Schedule and trigger warning timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages).toHaveLength(0); // No warning should be sent
    });
  });

  describe('Reset Timeout', () => {
    test('should reset session and send reset message', async () => {
      // Set up session with booking data
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_DROP);
      await sessionManager.setConversationData(testPhoneNumber, {
        pickupAddress: 'Moroni Centre'
      });
      
      // Schedule and trigger reset timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'RESET');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Check session was reset
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.MENU);
      
      // Check reset message was sent
      const sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBeGreaterThan(0);
      
      const resetMessage = sentMessages[sentMessages.length - 1];
      expect(resetMessage.body).toContain('Session expirée');
    });

    test('should not reset critical booking state', async () => {
      // Set up session in waiting state (critical)
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_WAITING);
      
      // Schedule and trigger reset timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'RESET');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Session should NOT be reset
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.BOOKING_WAITING);
    });

    test('should increment timeout count', async () => {
      await sessionManager.getSession(testPhoneNumber);
      
      // Schedule and trigger reset timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'RESET');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(1);
    });
  });

  describe('Cleanup Timeout', () => {
    test('should delete session completely', async () => {
      // Create session
      await sessionManager.getSession(testPhoneNumber);
      
      // Verify session exists
      const sessionBefore = await sessionManager.getSession(testPhoneNumber);
      expect(sessionBefore).toBeDefined();
      
      // Schedule and trigger cleanup timeout
      timeoutManager.scheduleTimeout(testPhoneNumber, 'CLEANUP');
      
      // Wait for timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Check session was deleted from database
      const dbSession = await prisma.userSession.findUnique({
        where: { phoneNumber: testPhoneNumber }
      });
      expect(dbSession).toBeNull();
    });
  });

  describe('Timeout Lifecycle', () => {
    test('should progress through timeout stages', async () => {
      // Set up session in booking state
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_DROP);
      
      // Start with warning timeout
      timeoutManager.refreshTimeout(testPhoneNumber);
      
      // Wait for warning
      await new Promise(resolve => setTimeout(resolve, 150));
      
      let sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0].body).toContain('Toujours là');
      
      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 100));
      
      sentMessages = mockWhatsApp.getSentMessagesTo(testPhoneNumber);
      expect(sentMessages.length).toBe(2);
      expect(sentMessages[1].body).toContain('Session expirée');
      
      // Check session was reset
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.MENU);
    });
  });

  describe('Pause and Resume', () => {
    test('should pause timeouts', async () => {
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      await timeoutManager.pauseTimeouts(testPhoneNumber);
      
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).not.toContain('XXXX');
    });

    test('should resume timeouts', async () => {
      await timeoutManager.pauseTimeouts(testPhoneNumber);
      await timeoutManager.resumeTimeouts(testPhoneNumber);
      
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).toContain('XXXX');
    });
  });

  describe('User Activity Reset', () => {
    test('should reset timeout count on activity', async () => {
      // Create session with timeout count
      await sessionManager.incrementTimeoutCount(testPhoneNumber);
      await sessionManager.incrementTimeoutCount(testPhoneNumber);
      
      let session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(2);
      
      // Handle user activity
      await timeoutManager.handleUserActivity(testPhoneNumber);
      
      session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(0);
    });

    test('should refresh timeout on activity', async () => {
      const initialTimeouts = timeoutManager.getActiveTimeouts();
      
      await timeoutManager.handleUserActivity(testPhoneNumber);
      
      const newTimeouts = timeoutManager.getActiveTimeouts();
      expect(newTimeouts).toContain('XXXX'); // Should have new timeout
    });
  });

  describe('Error Handling', () => {
    test('should handle missing session gracefully', async () => {
      // Try to handle activity for non-existent session
      await expect(timeoutManager.handleUserActivity('nonexistent'))
        .resolves.toBeUndefined();
    });

    test('should handle message service errors', async () => {
      // Mock message service error
      const originalSendMessage = mockWhatsApp.sendMessage;
      mockWhatsApp.sendMessage = jest.fn().mockRejectedValue(new Error('Send failed'));
      
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_START);
      
      // Should not throw error
      timeoutManager.scheduleTimeout(testPhoneNumber, 'WARNING');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Restore original method
      mockWhatsApp.sendMessage = originalSendMessage;
    });
  });

  describe('Multiple Users', () => {
    test('should handle timeouts for multiple users', async () => {
      const user1 = '+269XXXXX01';
      const user2 = '+269XXXXX02';
      
      // Set up sessions for both users
      await sessionManager.setState(user1, ConversationState.BOOKING_START);
      await sessionManager.setState(user2, ConversationState.BOOKING_DROP);
      
      // Schedule timeouts for both
      timeoutManager.scheduleTimeout(user1, 'WARNING');
      timeoutManager.scheduleTimeout(user2, 'WARNING');
      
      // Wait for timeouts
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Both should have received warning messages
      const user1Messages = mockWhatsApp.getSentMessagesTo(user1);
      const user2Messages = mockWhatsApp.getSentMessagesTo(user2);
      
      expect(user1Messages.length).toBe(1);
      expect(user2Messages.length).toBe(1);
    });

    test('should clear individual user timeouts', async () => {
      const user1 = '+269XXXXX01';
      const user2 = '+269XXXXX02';
      
      timeoutManager.scheduleTimeout(user1, 'WARNING');
      timeoutManager.scheduleTimeout(user2, 'WARNING');
      
      timeoutManager.clearTimeout(user1);
      
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).toHaveLength(1); // Only user2's timeout should remain
    });
  });

  describe('Shutdown', () => {
    test('should clear all timeouts on shutdown', async () => {
      const user1 = '+269XXXXX01';
      const user2 = '+269XXXXX02';
      
      timeoutManager.scheduleTimeout(user1, 'WARNING');
      timeoutManager.scheduleTimeout(user2, 'WARNING');
      
      timeoutManager.shutdown();
      
      const activeTimeouts = timeoutManager.getActiveTimeouts();
      expect(activeTimeouts).toHaveLength(0);
    });
  });
});