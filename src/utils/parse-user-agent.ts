export interface ParsedUserAgent {
  browser: string;
  os: string;
}

/**
 * Turns a raw User-Agent string into a short browser/OS pair (e.g. Firefox /
 * Linux) for display, without pulling in a UA-parsing dependency. Order of
 * the checks matters: Edge and Opera also contain "Chrome" in their UA
 * string, and iOS/iPadOS also contain "Mac OS X", so the more specific
 * patterns must be checked first.
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  let browser = 'Unknown';
  if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(userAgent)) browser = 'Opera';
  else if (/Firefox\//.test(userAgent)) browser = 'Firefox';
  else if (/Chrome\//.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//.test(userAgent)) browser = 'Safari';

  let os = 'Unknown';
  if (/Android/.test(userAgent)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(userAgent)) os = 'iOS';
  else if (/Windows/.test(userAgent)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(userAgent)) os = 'macOS';
  else if (/Linux/.test(userAgent)) os = 'Linux';

  return { browser, os };
}
