import { messageAckSchema, sendMessageEventSchema, sendMessageSchema } from './messages.js';

describe('sendMessageSchema', () => {
  it('trims and bounds content', () => {
    expect(sendMessageSchema.parse({ content: ' hi ' })).toEqual({ content: 'hi' });
    expect(sendMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('requires a recipient on the socket event', () => {
    expect(sendMessageEventSchema.safeParse({ content: 'hi' }).success).toBe(false);
    expect(
      sendMessageEventSchema.safeParse({
        content: 'hi',
        recipientId: '01a13ed6-d3ec-71cb-b39f-fbc256a293b9',
      }).success,
    ).toBe(true);
  });
});

describe('messageAckSchema', () => {
  it('discriminates success from failure', () => {
    const failure = {
      ok: false,
      error: { statusCode: 404, code: 'NOT_FOUND', message: 'User not found' },
    };
    expect(messageAckSchema.parse(failure)).toEqual(failure);
    expect(messageAckSchema.safeParse({ ok: true }).success).toBe(false);
  });
});
