import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationStore } from '../src/conversation-store.js';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(import.meta.dirname, 'test-conversations.db');

describe('ConversationStore', () => {
  let store: ConversationStore;

  beforeEach(() => {
    store = new ConversationStore(TEST_DB);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('stores and retrieves messages', () => {
    store.addMessage('chat1', 'user', 'Hello');
    store.addMessage('chat1', 'assistant', 'Hi there');

    const messages = store.getRecentMessages('chat1');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hi there');
  });

  it('limits to last 100 messages', () => {
    for (let i = 0; i < 120; i++) {
      store.addMessage('chat1', 'user', `Message ${i}`);
    }
    const messages = store.getRecentMessages('chat1');
    expect(messages).toHaveLength(100);
    expect(messages[0].content).toBe('Message 20');
  });

  it('isolates messages by chat_id', () => {
    store.addMessage('chat1', 'user', 'Chat 1');
    store.addMessage('chat2', 'user', 'Chat 2');

    expect(store.getRecentMessages('chat1')).toHaveLength(1);
    expect(store.getRecentMessages('chat2')).toHaveLength(1);
  });

  it('clears messages for a specific chat', () => {
    store.addMessage('chat1', 'user', 'Hello');
    store.addMessage('chat2', 'user', 'World');

    store.clearChat('chat1');

    expect(store.getRecentMessages('chat1')).toHaveLength(0);
    expect(store.getRecentMessages('chat2')).toHaveLength(1);
  });

  it('tracks token usage', () => {
    store.addMessage('chat1', 'assistant', 'Response', {
      inputTokens: 500,
      outputTokens: 200,
    });
    store.recordToolCalls('chat1', 3);

    const usage = store.getDailyUsage('chat1');
    expect(usage.total_input_tokens).toBe(500);
    expect(usage.total_output_tokens).toBe(200);
    expect(usage.total_tool_calls).toBe(3);
  });

  it('accumulates daily usage across messages', () => {
    store.addMessage('chat1', 'assistant', 'R1', { inputTokens: 100, outputTokens: 50 });
    store.addMessage('chat1', 'assistant', 'R2', { inputTokens: 200, outputTokens: 75 });

    const usage = store.getDailyUsage('chat1');
    expect(usage.total_input_tokens).toBe(300);
    expect(usage.total_output_tokens).toBe(125);
  });

  it('stores tool_use metadata as JSON', () => {
    const toolUse = [{ name: 'send_email', id: 'tu_1', input: { to: 'a@b.com' } }];
    store.addMessage('chat1', 'assistant', 'Sent', { toolUse });

    const messages = store.getRecentMessages('chat1');
    expect(messages[0].tool_use).toEqual(toolUse);
  });
});
