export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.protocol === 'file:') return raw;
    // remove common tracking params
    const TRACKING = /^(utm_|gclid$|gbraid$|gad_|gclsrc$|c$)/i;
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKING.test(key)) u.searchParams.delete(key);
    }
    return u.origin + u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '');
  } catch (e) {
    return raw;
  }
}

export default canonicalizeUrl;
