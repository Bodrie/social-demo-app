import { act, screen, waitFor } from '@testing-library/react';
import { SOCKET_EVENTS } from '@the-mesh/shared';
import { alice, bob, makeMessage } from '@/test/fixtures';
import { seedDirect } from '@/test/msw/db';
import { signedInAs } from '@/test/msw/handlers';
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

beforeEach(() => {
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
  it('plays a sound and shows a notification for a message while the tab is hidden, by preference', async () => {
    const me = signedInAs(alice);
    me.settings = { ...me.settings, messageSound: true, browserNotifications: true };
    const withBob = seedDirect(alice.id, bob.id);
    renderApp('/');
    await screen.findByLabelText('New post');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    // Visible tab: the bubble is enough, no alert.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Hi')),
    );
    await screen.findByRole('button', { name: /Open chat with Bob Brown/ });
    expect(oscillators).not.toHaveBeenCalled();
    expect(shown).toEqual([]);

    visibility = 'hidden';
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Lunch?')),
    );
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]).toEqual({ title: 'Bob Brown', options: { body: 'Lunch?', tag: withBob.id } });
    // Two notes make the blip.
    expect(oscillators).toHaveBeenCalledTimes(2);

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
