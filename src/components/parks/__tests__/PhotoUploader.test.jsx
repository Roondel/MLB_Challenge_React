import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUsePhotoUrl = vi.fn();
vi.mock('../../../hooks/usePhotoUrl', () => ({
  usePhotoUrl: (key) => mockUsePhotoUrl(key),
}));

const mockCompressToBlob = vi.fn();
vi.mock('../../../services/imageUtils', () => ({
  compressToBlob: (...args) => mockCompressToBlob(...args),
}));

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/preview');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

import PhotoUploader from '../PhotoUploader.jsx';

const noop = () => {};

beforeEach(() => {
  mockUsePhotoUrl.mockReturnValue(null);
  mockCompressToBlob.mockResolvedValue(new Blob(['compressed'], { type: 'image/jpeg' }));
  vi.clearAllMocks();
  mockCreateObjectURL.mockReturnValue('blob:http://localhost/preview');
});

// ── Upload button state ───────────────────────────────────────────────────────

describe('PhotoUploader — no photo', () => {
  it('renders the upload button when there is no current photo', () => {
    render(<PhotoUploader currentKey={null} onChange={noop} />);
    expect(screen.getByText('Upload baseball photo')).toBeTruthy();
  });

  it('includes a hidden file input', () => {
    const { container } = render(<PhotoUploader currentKey={null} onChange={noop} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input.className).toContain('hidden');
  });
});

// ── Existing photo display ────────────────────────────────────────────────────

describe('PhotoUploader — with existing S3 key', () => {
  it('renders the resolved S3 photo when usePhotoUrl returns a URL', () => {
    mockUsePhotoUrl.mockReturnValue('https://cdn.example.com/photo.jpg');
    render(<PhotoUploader currentKey="photos/109/photo.jpg" onChange={noop} />);

    const img = screen.getByAltText('Baseball');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('passes the S3 key to usePhotoUrl', () => {
    render(<PhotoUploader currentKey="photos/109/photo.jpg" onChange={noop} />);
    expect(mockUsePhotoUrl).toHaveBeenCalledWith('photos/109/photo.jpg');
  });

  it('renders a legacy base64 key directly without calling usePhotoUrl for it', () => {
    const base64 = 'data:image/jpeg;base64,/9j/fake';
    render(<PhotoUploader currentKey={base64} onChange={noop} />);

    const img = screen.getByAltText('Baseball');
    expect(img.getAttribute('src')).toBe(base64);
    // base64 must not be forwarded to the API resolver
    expect(mockUsePhotoUrl).toHaveBeenCalledWith(null);
  });
});

// ── File picking ──────────────────────────────────────────────────────────────

describe('PhotoUploader — file selection', () => {
  it('calls onChange with a Blob when a file is picked', async () => {
    const onChange = vi.fn();
    const { container } = render(<PhotoUploader currentKey={null} onChange={onChange} />);

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledOnce();
      const [arg] = onChange.mock.calls[0];
      expect(arg).toBeInstanceOf(Blob);
    });
  });

  it('shows the blob object URL as the preview after file selection', async () => {
    const { container } = render(<PhotoUploader currentKey={null} onChange={noop} />);
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    await waitFor(() => {
      const img = screen.getByAltText('Baseball');
      expect(img.getAttribute('src')).toBe('blob:http://localhost/preview');
    });
  });
});

// ── Clear button ──────────────────────────────────────────────────────────────

describe('PhotoUploader — clearing a photo', () => {
  it('calls onChange(null) when the X button is clicked', async () => {
    mockUsePhotoUrl.mockReturnValue('https://cdn.example.com/photo.jpg');
    const onChange = vi.fn();
    render(<PhotoUploader currentKey="photos/109/photo.jpg" onChange={onChange} />);

    const clearBtn = screen.getByRole('button');
    fireEvent.click(clearBtn);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
