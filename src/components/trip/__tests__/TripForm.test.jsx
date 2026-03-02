import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import TripForm from '../TripForm.jsx';

function renderForm(props = {}) {
  return render(<TripForm onSearch={vi.fn()} loading={false} {...props} />);
}

// ── Labels ────────────────────────────────────────────────────────────────────

describe('TripForm — structure', () => {
  it('renders Start Date, End Date, and Starting City labels', () => {
    renderForm();
    expect(screen.getByText('Start Date')).toBeTruthy();
    expect(screen.getByText('End Date')).toBeTruthy();
    expect(screen.getByText('Starting City')).toBeTruthy();
  });

  it('renders the Find Games submit button', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /find games/i })).toBeTruthy();
  });
});

// ── Date inputs ───────────────────────────────────────────────────────────────

describe('TripForm — date inputs', () => {
  it('renders two date inputs', () => {
    renderForm();
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2);
  });

  it('auto-nudges end date to match start date when end date is empty', () => {
    renderForm();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2025-07-04' } });
    expect(dateInputs[1].value).toBe('2025-07-04');
  });

  it('does not nudge end date when end date is already beyond the new start date', () => {
    renderForm();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: '2025-07-20' } });
    fireEvent.change(dateInputs[0], { target: { value: '2025-07-04' } });
    expect(dateInputs[1].value).toBe('2025-07-20');
  });
});

// ── Button disabled state ─────────────────────────────────────────────────────

describe('TripForm — disabled state', () => {
  it('disables Find Games when dates are empty', () => {
    renderForm();
    const btn = screen.getByRole('button', { name: /find games/i });
    expect(btn.disabled).toBe(true);
  });

  it('disables Find Games while loading', () => {
    renderForm({ loading: true });
    // Button still reads "Find Games" when loading (spinner replaces the icon, not the text)
    const btn = screen.getByRole('button', { name: /find games/i });
    expect(btn.disabled).toBe(true);
  });
});

// ── Starting city dropdown ────────────────────────────────────────────────────

describe('TripForm — city dropdown', () => {
  it('has "Any city" as the default option', () => {
    renderForm();
    expect(screen.getByText('Any city')).toBeTruthy();
  });

  it('includes all 30 MLB cities', () => {
    renderForm();
    // Spot-check a few cities that must be in the dropdown
    expect(screen.getByText('Phoenix, AZ')).toBeTruthy();
    expect(screen.getByText('Boston, MA')).toBeTruthy();
    expect(screen.getByText('New York, NY')).toBeTruthy();
    expect(screen.getByText('Chicago, IL')).toBeTruthy();
  });

  it('uses "New York" not "Bronx" for NY teams', () => {
    renderForm();
    expect(screen.queryByText('Bronx, NY')).toBeNull();
    expect(screen.getByText('New York, NY')).toBeTruthy();
  });

  it('uses "Tampa" not "St. Petersburg" for the Rays', () => {
    renderForm();
    expect(screen.queryByText('St. Petersburg, FL')).toBeNull();
    expect(screen.getByText('Tampa, FL')).toBeTruthy();
  });
});

// ── Submission ────────────────────────────────────────────────────────────────

describe('TripForm — submission', () => {
  it('calls onSearch with startDate, endDate, and startCity', () => {
    const onSearch = vi.fn();
    renderForm({ onSearch });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2025-07-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2025-07-10' } });

    fireEvent.submit(screen.getByRole('button', { name: /find games/i }).closest('form'));

    expect(onSearch).toHaveBeenCalledWith({
      startDate: '2025-07-01',
      endDate:   '2025-07-10',
      startCity: '',
    });
  });

  it('shows an error when end date is before start date', () => {
    renderForm();
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2025-07-10' } });
    // end date is nudged to match start date by handleStartDateChange
    // set it back to before start date manually
    fireEvent.change(dateInputs[1], { target: { value: '2025-07-05' } });

    fireEvent.submit(dateInputs[0].closest('form'));

    expect(screen.getByText(/end date must be on or after/i)).toBeTruthy();
  });
});
