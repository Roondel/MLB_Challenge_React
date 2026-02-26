import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Notification is not fully implemented in jsdom
global.Notification = Object.assign(vi.fn(), {
  permission: 'default',
  requestPermission: vi.fn().mockResolvedValue('default'),
});
