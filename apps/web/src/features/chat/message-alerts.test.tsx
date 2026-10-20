import { act, screen, waitFor, within } from '@testing-library/react';
import { SOCKET_EVENTS } from '@beso/shared';
import { alice, bob, makeMessage } from '@/test/fixtures';
import { seedDirect } from '@/test/msw/db';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const oscillators = vi.fn();
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  resume = vi.fn(() => Promise.resolve());
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createOscillator() {
    oscillators();
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
}

const shown: { title: string; options: NotificationOptions | undefined }[] = [];
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(() => Promise.resolve('granted' as const));
  addEventListener = vi.fn();
  close = vi.fn();
  constructor(title: string, options?: NotificationOptions) {
    shown.push({ title, options });
  }
}

let visibility: DocumentVisibilityState = 'visible';

beforeEach(async () => {
  // The shell loads the alerts lazily; with the module already loaded they mount with the page.
  await import('./message-alerts');
  oscillators.mockClear();
  shown.length = 0;
  visibility = 'visible';
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('Notification', FakeNotification);
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('message alerts', () => {
  it('plays a sound for a message not on screen, hidden tab or not, and notifies only while hidden', async () => {
    const me = signedInAs(alice);
    me.settings = { ...me.settings, messageSound: true, browserNotifications: true };
    const withBob = seedDirect(alice.id, bob.id);
    renderApp('/');
    await screen.findByLabelText('New post');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    // Visible tab, conversation not on screen: the bubble appears and the blip plays (two
    // notes make it); the bubble is the notification.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Hi')),
    );
    await screen.findByRole('button', { name: /Open chat with Bob Brown/ });
    expect(oscillators).toHaveBeenCalledTimes(2);
    expect(shown).toEqual([]);

    visibility = 'hidden';
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Lunch?')),
    );
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]).toEqual({ title: 'Bob Brown', options: { body: 'Lunch?', tag: withBob.id } });
    expect(oscillators).toHaveBeenCalledTimes(4);

    // My own message in another tab, and a system line, are no news.
    act(() => {
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, alice.id, 'Back'));
      fakeSocket.serverEmit(
        SOCKET_EVENTS.messageNew,
        makeMessage(withBob.id, bob.id, '', {
          kind: 'system',
          system: { type: 'renamed', actor: { id: bob.id, name: 'Bob' }, users: [], title: 'X' },
        }),
      );
    });
    expect(shown).toHaveLength(1);
    expect(oscillators).toHaveBeenCalledTimes(4);
  });

  it('stays silent for the thread that is open on screen', async () => {
    const me = signedInAs(alice);
    me.settings = { ...me.settings, messageSound: true, browserNotifications: false };
    const withBob = seedDirect(alice.id, bob.id);
    mockDb.messages.push(makeMessage(withBob.id, bob.id, 'Earlier'));
    renderApp(`/messages/${withBob.id}`);
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('Earlier');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    // Hidden tab: the thread is not on screen, so the blip plays.
    visibility = 'hidden';
    act(() =>
      fakeSocket.serverEmit(
        SOCKET_EVENTS.messageNew,
        makeMessage(withBob.id, bob.id, 'Still there?'),
      ),
    );
    await within(log).findByText('Still there?');
    await waitFor(() => expect(oscillators).toHaveBeenCalledTimes(2));

    // Visible again: a message in the open thread is read on arrival, nothing to hear.
    visibility = 'visible';
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Yes')),
    );
    await within(log).findByText('Yes');
    expect(oscillators).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when the preferences are off or the permission is missing', async () => {
    const me = signedInAs(alice);
    me.settings = { ...me.settings, messageSound: false, browserNotifications: true };
    FakeNotification.permission = 'default';
    const withBob = seedDirect(alice.id, bob.id);
    renderApp('/');
    await screen.findByLabelText('New post');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));
    visibility = 'hidden';
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Lunch?')),
    );
    await screen.findByRole('button', { name: /Open chat with Bob Brown/ });
    expect(shown).toEqual([]);
    expect(oscillators).not.toHaveBeenCalled();
    FakeNotification.permission = 'granted';
  });
});
