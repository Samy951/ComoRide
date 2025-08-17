import { SessionManager } from '../../src/bot/states/session.manager';
import { ConversationState } from '../../src/bot/states/state.types';
import prisma from '../../src/config/database';

describe('Session Management', () => {
  let sessionManager: SessionManager;
  const testPhoneNumber = '+269XXXXX01';

  beforeEach(async () => {
    // Clear database
    await prisma.userSession.deleteMany();
    
    // Get fresh instance
    sessionManager = SessionManager.getInstance();
  });

  afterEach(async () => {
    await prisma.userSession.deleteMany();
  });

  describe('Session Creation', () => {
    test('should create new session for unknown user', async () => {
      const session = await sessionManager.getSession(testPhoneNumber);
      
      expect(session).toBeDefined();
      expect(session.phoneNumber).toBe(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.MENU);
      expect(session.conversationData).toBeDefined();
      expect(session.timeoutCount).toBe(0);
    });

    test('should return existing session for known user', async () => {
      // Create first session
      const session1 = await sessionManager.getSession(testPhoneNumber);
      const sessionId1 = session1.id;
      
      // Get session again
      const session2 = await sessionManager.getSession(testPhoneNumber);
      
      expect(session2.id).toBe(sessionId1);
      expect(session2.phoneNumber).toBe(testPhoneNumber);
    });
  });

  describe('Session Updates', () => {
    test('should update session state', async () => {
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_START);
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.BOOKING_START);
    });

    test('should update conversation data', async () => {
      const testData = {
        pickupAddress: 'Moroni Centre',
        dropAddress: 'Aéroport'
      };
      
      await sessionManager.setConversationData(testPhoneNumber, testData);
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.conversationData.pickupAddress).toBe('Moroni Centre');
      expect(session.conversationData.dropAddress).toBe('Aéroport');
    });

    test('should merge conversation data updates', async () => {
      // Set initial data
      await sessionManager.setConversationData(testPhoneNumber, {
        pickupAddress: 'Moroni Centre'
      });
      
      // Update with additional data
      await sessionManager.setConversationData(testPhoneNumber, {
        dropAddress: 'Aéroport'
      });
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.conversationData.pickupAddress).toBe('Moroni Centre');
      expect(session.conversationData.dropAddress).toBe('Aéroport');
    });

    test('should update lastMessageAt on any update', async () => {
      const session1 = await sessionManager.getSession(testPhoneNumber);
      const initialTime = session1.lastMessageAt;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_START);
      
      const session2 = await sessionManager.getSession(testPhoneNumber);
      expect(session2.lastMessageAt.getTime()).toBeGreaterThan(initialTime.getTime());
    });
  });

  describe('Session Reset', () => {
    test('should reset session to menu state', async () => {
      // Set up session with data
      await sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_CONFIRM);
      await sessionManager.setConversationData(testPhoneNumber, {
        pickupAddress: 'Moroni Centre',
        dropAddress: 'Aéroport'
      });
      await sessionManager.incrementTimeoutCount(testPhoneNumber);
      
      // Reset session
      const resetSession = await sessionManager.resetSession(testPhoneNumber);
      
      expect(resetSession.currentState).toBe(ConversationState.MENU);
      expect(resetSession.conversationData.pickupAddress).toBeNull();
      expect(resetSession.conversationData.dropAddress).toBeNull();
      expect(resetSession.timeoutCount).toBe(0);
    });
  });

  describe('Timeout Management', () => {
    test('should increment timeout count', async () => {
      const count1 = await sessionManager.incrementTimeoutCount(testPhoneNumber);
      expect(count1).toBe(1);
      
      const count2 = await sessionManager.incrementTimeoutCount(testPhoneNumber);
      expect(count2).toBe(2);
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(2);
    });

    test('should reset timeout count on session reset', async () => {
      await sessionManager.incrementTimeoutCount(testPhoneNumber);
      await sessionManager.incrementTimeoutCount(testPhoneNumber);
      
      await sessionManager.resetSession(testPhoneNumber);
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.timeoutCount).toBe(0);
    });
  });

  describe('Session Deletion', () => {
    test('should delete session from database and cache', async () => {
      // Create session
      await sessionManager.getSession(testPhoneNumber);
      
      // Verify it exists in database
      const dbSession = await prisma.userSession.findUnique({
        where: { phoneNumber: testPhoneNumber }
      });
      expect(dbSession).toBeTruthy();
      
      // Delete session
      await sessionManager.deleteSession(testPhoneNumber);
      
      // Verify it's deleted from database
      const deletedSession = await prisma.userSession.findUnique({
        where: { phoneNumber: testPhoneNumber }
      });
      expect(deletedSession).toBeNull();
    });
  });

  describe('Active Sessions', () => {
    test('should return active sessions (non-menu states)', async () => {
      // Create sessions in different states
      await sessionManager.setState('+269XXXXX01', ConversationState.BOOKING_START);
      await sessionManager.setState('+269XXXXX02', ConversationState.MENU);
      await sessionManager.setState('+269XXXXX03', ConversationState.BOOKING_CONFIRM);
      
      const activeSessions = await sessionManager.getActiveSessions();
      
      expect(activeSessions).toHaveLength(2);
      
      const phoneNumbers = activeSessions.map(s => s.phoneNumber);
      expect(phoneNumbers).toContain('+269XXXXX01');
      expect(phoneNumbers).toContain('+269XXXXX03');
      expect(phoneNumbers).not.toContain('+269XXXXX02');
    });
  });

  describe('Session Count', () => {
    test('should return correct session count', async () => {
      await sessionManager.getSession('+269XXXXX01');
      await sessionManager.getSession('+269XXXXX02');
      await sessionManager.getSession('+269XXXXX03');
      
      const count = await sessionManager.getSessionCount();
      expect(count).toBe(3);
    });
  });

  describe('Database Restoration', () => {
    test('should restore sessions from database', async () => {
      // Create session directly in database
      await prisma.userSession.create({
        data: {
          phoneNumber: testPhoneNumber,
          currentState: ConversationState.BOOKING_CONFIRM,
          conversationData: {
            pickupAddress: 'Moroni Centre',
            dropAddress: 'Aéroport'
          },
          lastMessageAt: new Date(),
          timeoutCount: 0
        }
      });
      
      // Clear cache and restore
      await sessionManager.restoreSessionsFromDB();
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.currentState).toBe(ConversationState.BOOKING_CONFIRM);
      expect(session.conversationData.pickupAddress).toBe('Moroni Centre');
    });

    test('should only restore recent sessions', async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      // Create old session
      await prisma.userSession.create({
        data: {
          phoneNumber: '+269XXXXX99',
          currentState: ConversationState.BOOKING_START,
          conversationData: {},
          lastMessageAt: oldDate,
          timeoutCount: 0
        }
      });
      
      // Create recent session
      await prisma.userSession.create({
        data: {
          phoneNumber: testPhoneNumber,
          currentState: ConversationState.BOOKING_START,
          conversationData: {},
          lastMessageAt: new Date(),
          timeoutCount: 0
        }
      });
      
      await sessionManager.restoreSessionsFromDB();
      
      const sessionCount = await sessionManager.getSessionCount();
      expect(sessionCount).toBe(1); // Only recent session should be restored
    });
  });

  describe('Concurrent Access', () => {
    test('should handle concurrent session updates', async () => {
      const updates = [
        sessionManager.setConversationData(testPhoneNumber, { pickupAddress: 'Location 1' }),
        sessionManager.setConversationData(testPhoneNumber, { dropAddress: 'Location 2' }),
        sessionManager.setState(testPhoneNumber, ConversationState.BOOKING_CONFIRM),
        sessionManager.incrementTimeoutCount(testPhoneNumber)
      ];
      
      await Promise.all(updates);
      
      const session = await sessionManager.getSession(testPhoneNumber);
      expect(session.conversationData.pickupAddress).toBe('Location 1');
      expect(session.conversationData.dropAddress).toBe('Location 2');
      expect(session.currentState).toBe(ConversationState.BOOKING_CONFIRM);
      expect(session.timeoutCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalUpdate = prisma.userSession.update;
      prisma.userSession.update = jest.fn().mockRejectedValue(new Error('Database error'));
      
      // Should not throw error
      await expect(sessionManager.updateSession(testPhoneNumber, { timeoutCount: 1 }))
        .resolves.toBeDefined();
      
      // Restore original method
      prisma.userSession.update = originalUpdate;
    });

    test('should handle missing session gracefully', async () => {
      // Try to delete non-existent session
      await expect(sessionManager.deleteSession('nonexistent'))
        .resolves.toBeUndefined();
    });
  });

  describe('Memory Management', () => {
    test('should not exceed memory limits with many sessions', async () => {
      const sessionPromises = [];
      
      // Create 100 sessions
      for (let i = 0; i < 100; i++) {
        sessionPromises.push(
          sessionManager.getSession(`+269${String(i).padStart(6, '0')}`)
        );
      }
      
      await Promise.all(sessionPromises);
      
      const count = await sessionManager.getSessionCount();
      expect(count).toBe(100);
      
      // All sessions should be accessible
      const testSession = await sessionManager.getSession('+269000050');
      expect(testSession).toBeDefined();
    });
  });
});