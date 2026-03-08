import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTeamLogoUrl } from '../data/parks';
import {
  isIosSafari,
  isRunningAsStandalone,
  requestNotificationPermission,
  registerServiceWorker,
  showParkNotification,
} from './notifications';

const CHASE_FIELD = { teamId: 109, venueName: 'Chase Field', teamName: 'Arizona Diamondbacks' };

// Helper to override navigator.userAgent for a single test
function setUA(ua) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

// ─── isIosSafari ────────────────────────────────────────────────────────────

describe('isIosSafari', () => {
  it('returns true for iPhone Safari', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    expect(isIosSafari()).toBe(true);
  });

  it('returns false for iPhone Chrome (CriOS)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/117.0.0.0 Mobile/15E148 Safari/604.1');
    expect(isIosSafari()).toBe(false);
  });

  it('returns false for desktop Chrome', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36');
    expect(isIosSafari()).toBe(false);
  });

  it('returns false for Firefox iOS (FxiOS)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/117.0 Mobile/15E148 Safari/604.1');
    expect(isIosSafari()).toBe(false);
  });
});

// ─── isRunningAsStandalone ───────────────────────────────────────────────────

describe('isRunningAsStandalone', () => {
  beforeEach(() => {
    // Reset standalone each test
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  });

  it('returns true when matchMedia display-mode is standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(isRunningAsStandalone()).toBe(true);
  });

  it('returns true when navigator.standalone is true', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(isRunningAsStandalone()).toBe(true);
  });

  it('returns false when neither condition is met', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    expect(isRunningAsStandalone()).toBe(false);
  });
});

// ─── requestNotificationPermission ──────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns current permission without requesting when already granted', async () => {
    const requestMock = vi.fn();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: requestMock });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('returns current permission without requesting when already denied', async () => {
    const requestMock = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: requestMock });
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('calls requestPermission and returns result when permission is default', async () => {
    const requestMock = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: requestMock });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('returns denied when Notification API is unavailable', async () => {
    const orig = window.Notification;
    delete window.Notification;
    const result = await requestNotificationPermission();
    window.Notification = orig;
    expect(result).toBe('denied');
  });
});

// ─── registerServiceWorker ──────────────────────────────────────────────────

describe('registerServiceWorker', () => {
  it('returns registration on success', async () => {
    const mockReg = { active: { state: 'activated' } };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue(mockReg) },
      configurable: true,
    });
    const result = await registerServiceWorker();
    expect(result).toBe(mockReg);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('returns null when serviceWorker is not supported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('returns null when registration throws', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockRejectedValue(new Error('SW registration failed')) },
      configurable: true,
    });
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });
});

// ─── showParkNotification ────────────────────────────────────────────────────

describe('showParkNotification', () => {
  it('calls swReg.showNotification with correct title and options', () => {
    const showNotification = vi.fn();
    showParkNotification(CHASE_FIELD, { showNotification });
    expect(showNotification).toHaveBeenCalledWith(
      "You're near Chase Field!",
      expect.objectContaining({
        tag: 'park-nearby-109',
        renotify: false,
        data: { parkUrl: '/parks/109' },
      })
    );
  });

  it('includes team logo icon in notification options', () => {
    const showNotification = vi.fn();
    showParkNotification(CHASE_FIELD, { showNotification });
    expect(showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        icon: getTeamLogoUrl(CHASE_FIELD.teamId)
      })
    );
  });

  it('falls back to new Notification() when no swReg provided', () => {
    const NotifMock = vi.fn();
    vi.stubGlobal('Notification', Object.assign(NotifMock, { permission: 'granted' }));
    showParkNotification(CHASE_FIELD, null);
    expect(NotifMock).toHaveBeenCalledTimes(1);
  });

  it('does not create Notification when permission is not granted', () => {
    const NotifMock = vi.fn();
    vi.stubGlobal('Notification', Object.assign(NotifMock, { permission: 'denied' }));
    showParkNotification(CHASE_FIELD, null);
    expect(NotifMock).not.toHaveBeenCalled();
  });
});
