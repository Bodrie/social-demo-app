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

/** The address with its last part hidden: enough to tell two places apart, not to find one. */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  // An IPv4 address mapped into IPv6 (what Node reports behind a proxy) is still an IPv4.
  const v4 = /^(?:::ffff:)?(\d+\.\d+\.\d+)\.\d+$/i.exec(ip);
  if (v4) return `${v4[1]}.x`;
  if (ip.includes(':')) {
    const groups = ip.split(':');
    return `${groups.slice(0, 4).join(':')}:…`;
  }
  return null;
}
