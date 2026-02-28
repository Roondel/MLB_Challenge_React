import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

// Module-level cache in usePhotoUrl persists between renders.
// vi.resetModules() gives us a fresh cache for each test.

describe('usePhotoUrl', () => {
  let usePhotoUrl;
  let mockFetchDownloadUrl;

  beforeEach(async () => {
    vi.resetModules();
    mockFetchDownloadUrl = vi.fn();
    // Use vi.doMock (not vi.mock) because we need to configure after resetModules
    vi.doMock('../../services/api', () => ({
      fetchDownloadUrl: mockFetchDownloadUrl,
    }));
    const mod = await import('../usePhotoUrl.js');
    usePhotoUrl = mod.usePhotoUrl;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null immediately for a null key and never calls fetchDownloadUrl', () => {
    const { result } = renderHook(() => usePhotoUrl(null));
    expect(result.current).toBeNull();
    expect(mockFetchDownloadUrl).not.toHaveBeenCalled();
  });

  it('starts as null while the request is in flight', () => {
    // Never resolves in this test — we just check initial state
    mockFetchDownloadUrl.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));
    expect(result.current).toBeNull();
  });

  it('returns the resolved URL once fetchDownloadUrl resolves', async () => {
    mockFetchDownloadUrl.mockResolvedValue('https://cdn.example.com/photo.jpg');
    const { result } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));

    await waitFor(() => {
      expect(result.current).toBe('https://cdn.example.com/photo.jpg');
    });
    expect(mockFetchDownloadUrl).toHaveBeenCalledWith('photos/109/photo.jpg');
  });

  it('stays null and does not throw when fetchDownloadUrl rejects', async () => {
    mockFetchDownloadUrl.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));

    // Give time for the promise to reject
    await waitFor(() => {
      expect(mockFetchDownloadUrl).toHaveBeenCalledOnce();
    });
    expect(result.current).toBeNull();
  });

  it('uses the cache — a second mount for the same key does not re-fetch', async () => {
    mockFetchDownloadUrl.mockResolvedValue('https://cdn.example.com/photo.jpg');

    // First mount populates the cache
    const { result: r1, unmount } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));
    await waitFor(() => expect(r1.current).toBe('https://cdn.example.com/photo.jpg'));
    unmount();

    // Second mount should hit the cache synchronously (no extra fetch)
    const { result: r2 } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));
    expect(r2.current).toBe('https://cdn.example.com/photo.jpg'); // synchronous hit
    expect(mockFetchDownloadUrl).toHaveBeenCalledOnce(); // still only one API call
  });

  it('deduplicates concurrent requests for the same key', async () => {
    let resolvePromise;
    const sharedPromise = new Promise(r => { resolvePromise = r; });
    mockFetchDownloadUrl.mockReturnValue(sharedPromise);

    const { result: r1 } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));
    const { result: r2 } = renderHook(() => usePhotoUrl('photos/109/photo.jpg'));

    // Both hooks are in flight but only one fetch was made
    expect(mockFetchDownloadUrl).toHaveBeenCalledOnce();

    resolvePromise('https://cdn.example.com/photo.jpg');

    await waitFor(() => expect(r1.current).toBe('https://cdn.example.com/photo.jpg'));
    await waitFor(() => expect(r2.current).toBe('https://cdn.example.com/photo.jpg'));
  });

  it('returns null when key changes to null', async () => {
    mockFetchDownloadUrl.mockResolvedValue('https://cdn.example.com/photo.jpg');

    let key = 'photos/109/photo.jpg';
    const { result, rerender } = renderHook(() => usePhotoUrl(key));
    await waitFor(() => expect(result.current).toBe('https://cdn.example.com/photo.jpg'));

    key = null;
    rerender();
    expect(result.current).toBeNull();
  });
});
