import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAddVisit    = vi.fn().mockResolvedValue({});
const mockUpdateVisit = vi.fn().mockResolvedValue({});
vi.mock('../../../hooks/useVisits', () => ({
  useVisits: () => ({ addVisit: mockAddVisit, updateVisit: mockUpdateVisit }),
}));

const mockAddToast = vi.fn();
vi.mock('../../layout/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Suppress MLB API calls — return empty/null so the form doesn't auto-fill
vi.mock('../../../services/mlbApi', () => ({
  fetchGameForParkOnDate: vi.fn().mockResolvedValue(null),
  fetchWeatherForPark:    vi.fn().mockResolvedValue(null),
}));

const mockRequestUploadUrl = vi.fn();
const mockPutToS3          = vi.fn();
vi.mock('../../../services/api', () => ({
  API_AVAILABLE:    true,
  requestUploadUrl: (...a) => mockRequestUploadUrl(...a),
  putToS3:          (...a) => mockPutToS3(...a),
}));

vi.mock('../../../services/imageUtils', () => ({
  compressImage: vi.fn(),
}));

// Stub PhotoUploader — type="button" is critical so it doesn't submit the form
vi.mock('../PhotoUploader', () => ({
  default: ({ onChange }) => (
    <button
      type="button"
      data-testid="photo-uploader-stub"
      onClick={() => onChange(new Blob(['img'], { type: 'image/jpeg' }))}
    >
      Pick Photo
    </button>
  ),
}));

import CheckInModal from '../CheckInModal.jsx';

const park = {
  teamId:       109,
  teamName:     'Arizona Diamondbacks',
  venueName:    'Chase Field',
  abbreviation: 'ARI',
  lat:          33.4455,
  lng:          -112.0667,
};

const onClose = vi.fn();

// Render and wait for the initial async game/weather fetch effects to settle
async function renderAndSettle(visitOverride = undefined) {
  let result;
  await act(async () => {
    result = render(<CheckInModal park={park} visit={visitOverride} onClose={onClose} />);
  });
  return result;
}

function getForm() {
  return screen.getByRole('button', { name: /check in|save changes/i }).closest('form');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestUploadUrl.mockResolvedValue({ uploadUrl: 'https://s3.example.com/upload', key: 'photos/109/photo.jpg' });
  mockPutToS3.mockResolvedValue(undefined);
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('CheckInModal — rendering', () => {
  it('shows the park venue name and team name', async () => {
    await renderAndSettle();
    expect(screen.getByText(/Chase Field/)).toBeTruthy();
    expect(screen.getByText(/Arizona Diamondbacks/)).toBeTruthy();
  });

  it('shows "Check In" as the submit label for a new visit', async () => {
    await renderAndSettle();
    expect(screen.getByRole('button', { name: 'Check In' })).toBeTruthy();
  });

  it('shows "Save Changes" as the submit label when editing an existing visit', async () => {
    await renderAndSettle({
      visitId: '1', parkId: 109, visitDate: '2025-07-04',
      photoKeys: [], rating: 0, personalNote: '',
      gameAttended: false, opponent: '', gameScore: '', weather: '',
    });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeTruthy();
  });
});

// ── New check-in (no photo) ───────────────────────────────────────────────────

describe('CheckInModal — new check-in without photo', () => {
  it('calls addVisit with parkId and closes the modal', async () => {
    await renderAndSettle();

    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockAddVisit).toHaveBeenCalledOnce();
    expect(mockAddVisit.mock.calls[0][0].parkId).toBe(109);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a success toast on check-in', async () => {
    await renderAndSettle();

    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('Chase Field'),
      'success',
    );
  });

  it('does not call requestUploadUrl when no photo is picked', async () => {
    await renderAndSettle();

    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockRequestUploadUrl).not.toHaveBeenCalled();
  });
});

// ── New check-in with photo ───────────────────────────────────────────────────

describe('CheckInModal — new check-in with photo upload', () => {
  it('calls requestUploadUrl then putToS3, and saves with the returned key', async () => {
    await renderAndSettle();

    // Pick a photo (state update: setPendingBlob)
    await act(async () => {
      fireEvent.click(screen.getByTestId('photo-uploader-stub'));
    });

    // Submit the form (triggers async S3 upload)
    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockRequestUploadUrl).toHaveBeenCalledWith(109, 'photo.jpg', 'image/jpeg');
    expect(mockPutToS3).toHaveBeenCalledWith(
      'https://s3.example.com/upload',
      expect.any(Blob),
      'image/jpeg',
    );
    expect(mockAddVisit.mock.calls[0][0].photoKeys).toEqual(['photos/109/photo.jpg']);
  });

  it('saves the visit without blocking when photo upload fails', async () => {
    mockRequestUploadUrl.mockRejectedValueOnce(new Error('S3 error'));
    await renderAndSettle();

    await act(async () => {
      fireEvent.click(screen.getByTestId('photo-uploader-stub'));
    });

    await act(async () => {
      fireEvent.submit(getForm());
    });

    // Visit saved despite upload failure
    expect(mockAddVisit).toHaveBeenCalledOnce();
    // Error toast shown
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('Photo upload failed'),
      'error',
    );
  });
});

// ── Editing an existing visit ─────────────────────────────────────────────────

describe('CheckInModal — editing an existing visit', () => {
  const existingVisit = {
    visitId: '1', parkId: 109, visitDate: '2025-07-04',
    photoKeys: [], rating: 3, personalNote: 'Good game',
    gameAttended: false, opponent: '', gameScore: '', weather: '',
  };

  it('calls updateVisit (not addVisit) on submit', async () => {
    await renderAndSettle(existingVisit);

    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockUpdateVisit).toHaveBeenCalledOnce();
    expect(mockAddVisit).not.toHaveBeenCalled();
  });

  it('passes the existing visitId to updateVisit', async () => {
    await renderAndSettle(existingVisit);

    await act(async () => {
      fireEvent.submit(getForm());
    });

    expect(mockUpdateVisit.mock.calls[0][0]).toBe('1');
  });
});
