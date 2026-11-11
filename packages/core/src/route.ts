function normalizeSinglePath(path: string): string {
  let p = (path || '').trim();
  if (!p || p === '/') return '/';

  if (!p.startsWith('/')) {
    p = '/' + p;
  }

  while (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  if (p === '/index.html' || p === '/index.htm') {
    return '/';
  }
  if (p.endsWith('/index.html')) {
    p = p.slice(0, -'/index.html'.length) || '/';
  } else if (p.endsWith('/index.htm')) {
    p = p.slice(0, -'/index.htm'.length) || '/';
  } else if (p.endsWith('.html')) {
    p = p.slice(0, -'.html'.length) || '/';
  } else if (p.endsWith('.htm')) {
    p = p.slice(0, -'.htm'.length) || '/';
  }

  return p || '/';
}

/**
 * Normalizes a route string so equivalent paths (e.g. `/` and `/index.html`,
 * `/about.html` and `/about/`, `/about?x=1#top` and `/about`, or `/#/about` and `/#!/about`)
 * resolve to the same canonical route identifier.
 */
export function normalizeRoute(path: string): string {
  const raw = (path || '').trim();
  if (!raw) return '/';

  // Preserve hash-router paths (`#/...` or `#!/...`), stripping query strings
  const hashRouterMatch = raw.match(/^(.*?)(#!?\/.*)$/);
  if (hashRouterMatch) {
    const baseRaw = hashRouterMatch[1].split('?')[0];
    const hashRaw = hashRouterMatch[2].split('?')[0];
    const hashPathRaw = hashRaw.startsWith('#!/') ? hashRaw.slice(2) : hashRaw.slice(1);
    const normBase = normalizeSinglePath(baseRaw);
    const normHash = normalizeSinglePath(hashPathRaw);
    return normBase === '/' ? `/#${normHash}` : `${normBase}/#${normHash}`;
  }

  const withoutQueryOrAnchor = raw.split(/[?#]/)[0];
  return normalizeSinglePath(withoutQueryOrAnchor);
}
