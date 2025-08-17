import { EventEmitter } from 'events';

export interface MockMessage {
  from: string;
  body: string;
  timestamp: number;
  type: string;
  fromMe: boolean;
}

export class MockWhatsAppClient extends EventEmitter {
  private isReady: boolean = false;
  private messageHistory: Map<string, MockMessage[]> = new Map();
  private sentMessages: MockMessage[] = [];

  constructor() {
    super();
    this.setMaxListeners(20); // Increase for testing
  }

  async initialize(): Promise<void> {
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.isReady = true;
    this.emit('ready');
  }

  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId: string }> {
    if (!this.isReady) {
      throw new Error('Client not ready');
    }

    const mockMessage: MockMessage = {
      from: 'bot@c.us',
      body: message,
      timestamp: Date.now(),
      type: 'chat',
      fromMe: true
    };

    this.sentMessages.push(mockMessage);
    
    // Store in conversation history
    const normalizedTo = this.normalizePhoneNumber(to);
    if (!this.messageHistory.has(normalizedTo)) {
      this.messageHistory.set(normalizedTo, []);
    }
    this.messageHistory.get(normalizedTo)!.push(mockMessage);

    return {
      success: true,
      messageId: `mock_msg_${Date.now()}`
    };
  }

  simulateIncomingMessage(from: string, body: string): void {
    const normalizedFrom = this.normalizePhoneNumber(from);
    
    const mockMessage: MockMessage = {
      from: normalizedFrom,
      body,
      timestamp: Date.now(),
      type: 'chat',
      fromMe: false
    };

    // Store in conversation history
    if (!this.messageHistory.has(normalizedFrom)) {
      this.messageHistory.set(normalizedFrom, []);
    }
    this.messageHistory.get(normalizedFrom)!.push(mockMessage);

    // Emit message event
    this.emit('message', mockMessage);
  }

  simulateDisconnection(reason: string = 'network_error'): void {
    this.isReady = false;
    this.emit('disconnected', reason);
  }

  simulateReconnection(): void {
    this.isReady = true;
    this.emit('ready');
  }

  async getChatById(chatId: string): Promise<MockChat> {
    const normalizedId = this.normalizePhoneNumber(chatId);
    return new MockChat(normalizedId, this.messageHistory.get(normalizedId) || []);
  }

  async getState(): Promise<string> {
    return this.isReady ? 'CONNECTED' : 'DISCONNECTED';
  }

  async destroy(): Promise<void> {
    this.isReady = false;
    this.removeAllListeners();
    this.messageHistory.clear();
    this.sentMessages = [];
  }

  // Test helper methods
  getLastSentMessage(): MockMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getSentMessagesTo(phoneNumber: string): MockMessage[] {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return this.sentMessages.filter(msg => 
      this.messageHistory.get(normalized)?.includes(msg)
    );
  }

  getMessageHistory(phoneNumber: string): MockMessage[] {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return this.messageHistory.get(normalized) || [];
  }

  clearHistory(): void {
    this.messageHistory.clear();
    this.sentMessages = [];
  }

  getSentMessageCount(): number {
    return this.sentMessages.length;
  }

  getConversationCount(): number {
    return this.messageHistory.size;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove @c.us suffix if present
    let cleaned = phoneNumber.replace('@c.us', '');
    
    // Add @c.us suffix for consistency
    if (!cleaned.endsWith('@c.us')) {
      cleaned += '@c.us';
    }
    
    return cleaned;
  }
}

class MockChat {
  constructor(
    private chatId: string,
    private messages: MockMessage[]
  ) {}

  async sendStateTyping(): Promise<void> {
    // Mock typing indicator
  }

  async clearState(): Promise<void> {
    // Mock clear typing indicator
  }

  async fetchMessages(options: { limit: number }): Promise<MockMessage[]> {
    return this.messages.slice(-options.limit);
  }
}

// Mock WhatsApp service for testing
export class MockWhatsAppService {
  private mockClient: MockWhatsAppClient;
  private messageHandlers: ((message: MockMessage) => void)[] = [];
  private readyHandlers: (() => void)[] = [];
  private disconnectedHandlers: ((reason: string) => void)[] = [];

  constructor() {
    this.mockClient = new MockWhatsAppClient();
    this.setupMockEvents();
  }

  private setupMockEvents(): void {
    this.mockClient.on('message', (message: MockMessage) => {
      this.messageHandlers.forEach(handler => handler(message));
    });

    this.mockClient.on('ready', () => {
      this.readyHandlers.forEach(handler => handler());
    });

    this.mockClient.on('disconnected', (reason: string) => {
      this.disconnectedHandlers.forEach(handler => handler(reason));
    });
  }

  async initialize(): Promise<void> {
    await this.mockClient.initialize();
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const result = await this.mockClient.sendMessage(phoneNumber, message);
      return result.success;
    } catch (error) {
      return false;
    }
  }

  onMessage(handler: (message: MockMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onReady(handler: () => void): void {
    this.readyHandlers.push(handler);
  }

  onDisconnected(handler: (reason: string) => void): void {
    this.disconnectedHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.mockClient.isReady;
  }

  async disconnect(): Promise<void> {
    await this.mockClient.destroy();
  }

  async sendTyping(phoneNumber: string): Promise<void> {
    // Mock typing indicator
  }

  async clearTyping(phoneNumber: string): Promise<void> {
    // Mock clear typing indicator
  }

  async getConnectionState(): Promise<string> {
    return await this.mockClient.getState();
  }

  async getChatHistory(phoneNumber: string, limit: number = 10): Promise<MockMessage[]> {
    const chat = await this.mockClient.getChatById(phoneNumber);
    return await chat.fetchMessages({ limit });
  }

  // Test helper methods
  simulateIncomingMessage(from: string, body: string): void {
    this.mockClient.simulateIncomingMessage(from, body);
  }

  simulateDisconnection(reason?: string): void {
    this.mockClient.simulateDisconnection(reason);
  }

  simulateReconnection(): void {
    this.mockClient.simulateReconnection();
  }

  getLastSentMessage(): MockMessage | undefined {
    return this.mockClient.getLastSentMessage();
  }

  getSentMessagesTo(phoneNumber: string): MockMessage[] {
    return this.mockClient.getSentMessagesTo(phoneNumber);
  }

  getMessageHistory(phoneNumber: string): MockMessage[] {
    return this.mockClient.getMessageHistory(phoneNumber);
  }

  clearHistory(): void {
    this.mockClient.clearHistory();
  }

  getSentMessageCount(): number {
    return this.mockClient.getSentMessageCount();
  }

  getConversationCount(): number {
    return this.mockClient.getConversationCount();
  }
}