import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { captureInstallPrompt } from '@/lib/install-prompt';
import { alice, bob } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/this-browser';
const PUBLIC_KEY = `B${'A'.repeat(86)}`;
const OWNER_KEY = 'beso.push.owner';

/** What `PushManager` hands out: enough of a `PushSubscription` for the app. */
class FakeSubscription {
  readonly endpoint = ENDPOINT;
  readonly options: { applicationServerKey: ArrayBuffer | null; userVisibleOnly: boolean };

  constructor(applicationServerKey: ArrayBuffer | null = null) {
    this.options = { applicationServerKey, userVisibleOnly: true };
  }

  toJSON() {
    return {
      endpoint: ENDPOINT,
      expirationTime: null,
      keys: { p256dh: `B${'q'.repeat(86)}`, auth: 'a'.repeat(22) },
    };
  }

  unsubscribe() {
    browser.unsubscribe();
    browser.subscription = null;
    return Promise.resolve(true);
  }
}

/** This browser's push: what PushManager holds, and what the page asked of it. */
const browser = {
  subscription: null as FakeSubscription | null,
  permission: 'default' as NotificationPermission,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

const fakeSubscription = () => new FakeSubscription();

beforeAll(() => {
  const registration = {
    pushManager: {
      getSubscription: () => Promise.resolve(browser.subscription),
      subscribe: (options: PushSubscriptionOptionsInit) => {
        browser.subscribe(options);
        browser.subscription = fakeSubscription();
        return Promise.resolve(browser.subscription);
      },
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(() => Promise.resolve(registration)),
      ready: Promise.resolve(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', {
    get permission() {
      return browser.permission;
    },
    requestPermission: vi.fn(() => {
      browser.permission = 'granted';
      return Promise.resolve('granted' as const);
    }),
  });
});

afterAll(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.unstubAllGlobals();
});

beforeEach(() => {
  browser.subscription = null;
  browser.permission = 'default';
  browser.subscribe.mockClear();
  browser.unsubscribe.mockClear();
  localStorage.removeItem(OWNER_KEY);
});

async function notificationsCard() {
  renderApp('/settings');
  const heading = await screen.findByRole('heading', { level: 2, name: 'Notifications' });
  const card = heading.closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error('no card around the heading');
  return card;
}

describe('push notifications', () => {
  it('says so when the server has push switched off, and offers nothing to switch', async () => {
    signedInAs(alice);
    const card = await notificationsCard();
    expect(
      await within(card).findByText('Push notifications are not set up on this server yet.'),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('switch', { name: 'Push notifications on this device' }),
    ).toBeDisabled();
    expect(within(card).queryByRole('switch', { name: 'New messages' })).not.toBeInTheDocument();
  });

  it('switches push on for this device: asks once, subscribes and hands it to the server', async () => {
    signedInAs(alice);
    mockDb.pushPublicKey = PUBLIC_KEY;
    const user = userEvent.setup();
    const card = await notificationsCard();
    const device = within(card).getByRole('switch', { name: 'Push notifications on this device' });
    await waitFor(() => expect(device).toBeEnabled());

    await user.click(device);

    await waitFor(() => expect(device).toBeChecked());
    expect(browser.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(mockDb.pushEndpoints).toEqual([ENDPOINT]);
    expect(localStorage.getItem(OWNER_KEY)).toBe(alice.id);
  });

  it('switches it off again: the browser and the server both forget the device', async () => {
    signedInAs(alice);
    mockDb.pushPublicKey = PUBLIC_KEY;
    browser.permission = 'granted';
    browser.subscription = fakeSubscription();
    localStorage.setItem(OWNER_KEY, alice.id);
    const user = userEvent.setup();
    const card = await notificationsCard();
    const device = within(card).getByRole('switch', { name: 'Push notifications on this device' });
    await waitFor(() => expect(device).toBeChecked());
    // Opening the app handed the existing subscription over again.
    await waitFor(() => expect(mockDb.pushEndpoints).toEqual([ENDPOINT]));

    await user.click(device);

    await waitFor(() => expect(device).not.toBeChecked());
    expect(browser.unsubscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockDb.pushEndpoints).toEqual([]));
  });

  it('drops a subscription another member left in this browser instead of taking it over', async () => {
    signedInAs(alice);
    mockDb.pushPublicKey = PUBLIC_KEY;
    browser.permission = 'granted';
    browser.subscription = fakeSubscription();
    localStorage.setItem(OWNER_KEY, bob.id);
    const card = await notificationsCard();

    await waitFor(() => expect(browser.unsubscribe).toHaveBeenCalledTimes(1));
    expect(mockDb.pushEndpoints).toEqual([]);
    expect(
      within(card).getByRole('switch', { name: 'Push notifications on this device' }),
    ).not.toBeChecked();
  });

  it('makes the subscription again when the server’s keys were replaced', async () => {
    signedInAs(alice);
    mockDb.pushPublicKey = PUBLIC_KEY;
    browser.permission = 'granted';
    browser.subscription = new FakeSubscription(new Uint8Array(65).fill(7).buffer);
    localStorage.setItem(OWNER_KEY, alice.id);
    await notificationsCard();

    await waitFor(() => expect(browser.subscribe).toHaveBeenCalledTimes(1));
    expect(browser.unsubscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockDb.pushEndpoints).toEqual([ENDPOINT]));
  });

  it('explains a blocked permission, and keeps the account’s choices', async () => {
    signedInAs(alice);
    mockDb.pushPublicKey = PUBLIC_KEY;
    browser.permission = 'denied';
    const user = userEvent.setup();
    const card = await notificationsCard();
    expect(
      await within(card).findByText(/Notifications are blocked for this site/),
    ).toBeInTheDocument();

    const previews = within(card).getByRole('switch', { name: 'Show what the message says' });
    expect(previews).toBeChecked();
    await user.click(within(card).getByRole('switch', { name: 'New messages' }));
    await waitFor(() => expect(mockDb.user?.settings.pushMessages).toBe(false));
    // Without message pushes there is no text to show or hide.
    expect(previews).toBeDisabled();
  });

  it('offers to install the app where the browser makes the offer', async () => {
    signedInAs(alice);
    captureInstallPrompt();
    const prompt = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    const card = await notificationsCard();

    act(() => {
      const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      });
      window.dispatchEvent(offer);
    });
    await user.click(await within(card).findByRole('button', { name: 'Install BeSo' }));

    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(within(card).queryByRole('button', { name: 'Install BeSo' })).not.toBeInTheDocument(),
    );
  });
});
