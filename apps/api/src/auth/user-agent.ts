import { isIPv6 } from 'node:net';

/**
 * Enough of a user-agent string for the sessions list: "Chrome on Windows". Anything odd
 * becomes null rather than a guess; nobody needs a full parser for this.
 */
export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string | null;
  os: string | null;
} {
  if (!userAgent) return { browser: null, os: null };
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /HeadlessChrome\//.test(ua)
        ? 'Headless Chrome'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua) && /Version\//.test(ua)
              ? 'Safari'
              : null;
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /CrOS/.test(ua)
            ? 'ChromeOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  return { browser, os };
}

/**
 * The address with its last part hidden: enough to tell two places apart, not to find one.
 * IPv4 keeps its first three parts, IPv6 its network half (the first four of eight groups).
 */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  // An IPv4 address mapped into IPv6 (what Node reports behind a proxy) is still an IPv4.
  const v4 = /^(?:::ffff:)?(\d+\.\d+\.\d+)\.\d+$/i.exec(ip);
  if (v4) return `${v4[1]}.x`;
  const groups = ipv6Groups(ip);
  return groups ? `${groups.slice(0, 4).join(':')}:…` : null;
}

/**
 * The eight groups of an IPv6 address with `::` expanded, so that "the first four" is the
 * network half however the address was written (`2001:db8::1` is 2001:db8:0:0:0:0:0:1);
 * undefined for anything else.
 */
function ipv6Groups(ip: string): string[] | undefined {
  const address = ip.split('%')[0] ?? '';
  if (!isIPv6(address)) return undefined;
  const [head = '', tail] = address.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  // A trailing dotted IPv4 part (`64:ff9b::192.0.2.1`) fills two groups.
  const width = [...left, ...right].reduce((sum, part) => sum + (part.includes('.') ? 2 : 1), 0);
  const zeros = tail === undefined ? [] : Array.from({ length: 8 - width }, () => '0');
  return [...left, ...zeros, ...right];
}
