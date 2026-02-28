import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock usePhotoUrl ──────────────────────────────────────────────────────────

const mockUsePhotoUrl = vi.fn();
vi.mock('../../../hooks/usePhotoUrl', () => ({
  usePhotoUrl: (key) => mockUsePhotoUrl(key),
}));

import PhotoCard from '../PhotoCard.jsx';

const park = {
  teamId:    109,
  teamName:  'Arizona Diamondbacks',
  venueName: 'Chase Field',
  abbreviation: 'ARI',
};

function renderCard(parkOverride = park, visitOverride = undefined) {
  return render(
    <MemoryRouter>
      <PhotoCard park={parkOverride} visit={visitOverride} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUsePhotoUrl.mockReturnValue(null);
});

describe('PhotoCard', () => {
  it('renders the venue name', () => {
    renderCard();
    expect(screen.getByText('Chase Field')).toBeTruthy();
  });

  it('links to the correct park detail page', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/parks/109');
  });

  it('shows the team logo placeholder when there is no photo', () => {
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: [] });
    // Team logo img uses the MLB static URL
    const imgs = screen.getAllByRole('img');
    const logo = imgs.find(img => img.src.includes('mlbstatic.com'));
    expect(logo).toBeTruthy();
  });

  it('shows the photo when resolvedS3Url is available', () => {
    mockUsePhotoUrl.mockReturnValue('https://cdn.example.com/photo.jpg');
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: ['photos/109/photo.jpg'] });

    const img = screen.getByAltText('Baseball from Chase Field');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('falls back to legacy base64 key when usePhotoUrl returns null', () => {
    const base64 = 'data:image/jpeg;base64,/9j/fake';
    mockUsePhotoUrl.mockReturnValue(null); // S3 key not resolved yet
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: [base64] });

    const img = screen.getByAltText('Baseball from Chase Field');
    expect(img.getAttribute('src')).toBe(base64);
  });

  it('falls back to legacy baseballPhotoBase64 field', () => {
    const base64 = 'data:image/jpeg;base64,/9j/legacy';
    mockUsePhotoUrl.mockReturnValue(null);
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: [], baseballPhotoBase64: base64 });

    const img = screen.getByAltText('Baseball from Chase Field');
    expect(img.getAttribute('src')).toBe(base64);
  });

  it('does NOT pass an S3 key to usePhotoUrl when photoKeys[0] is a base64 string', () => {
    const base64 = 'data:image/jpeg;base64,/9j/fake';
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: [base64] });
    // base64 keys must not be forwarded to the API resolver
    expect(mockUsePhotoUrl).toHaveBeenCalledWith(null);
  });

  it('passes the S3 key to usePhotoUrl for non-base64 keys', () => {
    renderCard(park, { visitId: '1', parkId: 109, photoKeys: ['photos/109/photo.jpg'] });
    expect(mockUsePhotoUrl).toHaveBeenCalledWith('photos/109/photo.jpg');
  });

  it('shows the visited badge dot when there is a visit', () => {
    const { container } = renderCard(park, { visitId: '1', parkId: 109, photoKeys: [] });
    // The badge is a div with bg-accent class
    const badge = container.querySelector('.bg-accent.rounded-full');
    expect(badge).toBeTruthy();
  });

  it('does not show the visited badge when there is no visit', () => {
    const { container } = renderCard(park, undefined);
    const badge = container.querySelector('.bg-accent.rounded-full');
    expect(badge).toBeNull();
  });
});
