import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNearbyNotifier } from './useNearbyNotifier';
import * as notifications from '../services/notifications';

vi.mock('../services/notifications', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue({ showNotification: vi.fn() }),
  requestNotificationPermission: vi.fn().mockResolvedValue('granted'),
  isIosSafari: vi.fn().mockReturnValue(false),
  isRunningAsStandalone: vi.fn().mockReturnValue(true),
  showParkNotification: vi.fn(),
}));

// Chase Field — teamId 109, lat 33.4455, lng -112.0667
const AT_CHASE_FIELD = { coords: { latitude: 33.4455, longitude: -112.0667 } };
const IN_OCEAN       = { coords: { latitude: 0, longitude: 0 } };

function setupGeo() {
  let successCb = null;
  const watchPosition = vi.fn((success) => { successCb = success; return 42; });
  const clearWatch    = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    value: { watchPosition, clearWatch },
    configurable: true,
  });
  return {
    triggerPosition: (pos) => successCb?.(pos),
    watchPosition,
    clearWatch,
  };
}

// Flush the Promise.all().then() microtask chain (needs 2+ ticks)
const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(Notification, 'permission', { value: 'granted', configurable: true });
});

// ─── Mount / unmount ─────────────────────────────────────────────────────────

describe('lifecycle', () => {
  it('calls watchPosition after SW registration resolves', async () => {
    const { watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));
  });

  it('calls clearWatch with the watch ID on unmount', async () => {
    const { clearWatch, watchPosition } = setupGeo();
    const { unmount } = renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('does not throw when geolocation is unavailable', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    expect(() => renderHook(() => useNearbyNotifier())).not.toThrow();
  });
});

// ─── Proximity detection ──────────────────────────────────────────────────────

describe('proximity detection', () => {
  it('fires notification when within 0.5 miles of a park', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    const [parkArg] = notifications.showParkNotification.mock.calls[0];
    expect(parkArg.teamId).toBe(109);
  });

  it('does not fire notification when far from all parks', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(IN_OCEAN);
    expect(notifications.showParkNotification).not.toHaveBeenCalled();
  });

  it('only fires for the nearby park, not all 30', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).toHaveBeenCalledTimes(1);
    const [parkArg] = notifications.showParkNotification.mock.calls[0];
    expect(parkArg.teamId).toBe(109);
  });

  it('passes the real swReg (not null) to showParkNotification', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    const [, swRegArg] = notifications.showParkNotification.mock.calls[0];
    expect(swRegArg).not.toBeNull();
    expect(swRegArg).toHaveProperty('showNotification');
  });
});

// ─── Permission guard ─────────────────────────────────────────────────────────

describe('notification permission guard', () => {
  it('does not fire when permission is denied', async () => {
    Object.defineProperty(Notification, 'permission', { value: 'denied', configurable: true });
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).not.toHaveBeenCalled();
  });

  it('does not fire when permission is default', async () => {
    Object.defineProperty(Notification, 'permission', { value: 'default', configurable: true });
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).not.toHaveBeenCalled();
  });
});

// ─── Cooldown ─────────────────────────────────────────────────────────────────

describe('30-minute cooldown', () => {
  it('fires once on first arrival', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire within the cooldown window', async () => {
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());
    triggerPosition(AT_CHASE_FIELD);
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).toHaveBeenCalledTimes(1);
  });

  it('fires again after 30 minutes', async () => {
    vi.useFakeTimers();
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());

    // waitFor uses real timers internally — flush manually with fake timers active
    await flushPromises();
    expect(watchPosition).toHaveBeenCalled();

    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31 * 60 * 1000);
    triggerPosition(AT_CHASE_FIELD);
    expect(notifications.showParkNotification).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('cooldown is per-park — nearby parks fire independently', async () => {
    const AT_FENWAY = { coords: { latitude: 42.3467, longitude: -71.0972 } };
    const { triggerPosition, watchPosition } = setupGeo();
    renderHook(() => useNearbyNotifier());
    await waitFor(() => expect(watchPosition).toHaveBeenCalled());

    triggerPosition(AT_CHASE_FIELD);
    triggerPosition(AT_FENWAY);

    expect(notifications.showParkNotification).toHaveBeenCalledTimes(2);
    const ids = notifications.showParkNotification.mock.calls.map(([p]) => p.teamId);
    expect(ids).toContain(109);
    expect(ids).toContain(111);
  });
});
