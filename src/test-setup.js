import '@testing-library/jest-dom';
import { vi } from 'vitest';

// BroadcastChannel is not implemented in jsdom
global.BroadcastChannel = class {
  onmessage = null;
  postMessage() {}
  close() {}
};

// Notification is not fully implemented in jsdom
global.Notification = Object.assign(vi.fn(), {
  permission: 'default',
  requestPermission: vi.fn().mockResolvedValue('default'),
});
