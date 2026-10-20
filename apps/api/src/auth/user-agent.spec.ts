import { describeUserAgent, maskIp } from './user-agent.js';

describe('describeUserAgent', () => {
  it('names the common browsers and systems', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'Windows' });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      ),
    ).toEqual({ browser: 'Safari', os: 'macOS' });
    expect(
      describeUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'),
    ).toEqual({ browser: 'Firefox', os: 'Linux' });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Edg/130.0.0.0',
      ),
    ).toEqual({ browser: 'Edge', os: 'Android' });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Headless Chrome', os: 'Linux' });
  });

  it('admits what it does not know', () => {
    expect(describeUserAgent('curl/8.5.0')).toEqual({ browser: null, os: null });
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
  });
});

describe('maskIp', () => {
  it('hides the last part of an address', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.x');
    expect(maskIp('::ffff:203.0.113.42')).toBe('203.0.113.x');
    expect(maskIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe('2001:db8:85a3:0:…');
    expect(maskIp(undefined)).toBeNull();
    expect(maskIp('garbage')).toBeNull();
  });
});
