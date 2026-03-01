import { useState, useEffect } from 'react';
import { fetchDownloadUrl } from '../services/api';

// Module-level cache: key → { url, expiresAt }
// Persists across component mounts/unmounts within the same page session.
const urlCache = new Map();
const TTL_MS = 270_000; // 4.5 min — pre-signed URLs last 5 min, with 30s margin

// In-flight deduplication: prevents multiple simultaneous fetches for the same key.
// e.g. Gallery page with 30 cards all needing the same key sends only one request.
const inflight = new Map();

async function resolveUrl(s3Key) {
  const cached = urlCache.get(s3Key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  if (!inflight.has(s3Key)) {
    const promise = fetchDownloadUrl(s3Key)
      .then(url => {
        urlCache.set(s3Key, { url, expiresAt: Date.now() + TTL_MS });
        inflight.delete(s3Key);
        return url;
      })
      .catch(err => {
        inflight.delete(s3Key);
        throw err;
      });
    inflight.set(s3Key, promise);
  }

  return inflight.get(s3Key);
}

// Resolves an S3 key to a pre-signed download URL.
// Returns null while loading or on error, the URL string when ready.
// Passing null is safe — returns null immediately with no side effects.
export function usePhotoUrl(s3Key) {
  const [url, setUrl] = useState(() => {
    if (!s3Key) return null;
    // Synchronous cache hit on first render — no loading flash if already cached
    const cached = urlCache.get(s3Key);
    return cached && cached.expiresAt > Date.now() ? cached.url : null;
  });

  useEffect(() => {
    if (!s3Key) {
      setUrl(null);
      return;
    }

    // Re-check cache synchronously in case it was populated between renders
    const cached = urlCache.get(s3Key);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }

    let cancelled = false;
    resolveUrl(s3Key)
      .then(resolved => { if (!cancelled) setUrl(resolved); })
      .catch(() => { if (!cancelled) setUrl(null); });

    return () => { cancelled = true; };
  }, [s3Key]);

  return url;
}
