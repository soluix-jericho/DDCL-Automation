import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordDialog } from '../../src/screens/ChangePasswordDialog';
import { bodyOf, callsTo, json, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

async function submit(current: string, next: string) {
  const user = userEvent.setup();
  await user.type(screen.getByTestId('cp-current'), current);
  await user.type(screen.getByTestId('cp-new'), next);
  await user.click(screen.getByTestId('cp-submit'));
}

describe('Ganti Kata Sandi (BR4.12)', () => {
  it('shows the length limits up front', () => {
    mockFetch('viewer');
    render(<ChangePasswordDialog onClose={() => undefined} />);
    expect(screen.getByTestId('cp-hint')).toHaveTextContent('Minimal 10 karakter');
  });

  it('sends the old and new password, confirms, and empties the fields', async () => {
    const fetchMock = mockFetch('viewer', { 'POST /api/v1/auth/password': () => new Response(null, { status: 204 }) });
    render(<ChangePasswordDialog onClose={() => undefined} />);
    await submit('sandi-lama-1234', 'sandi-baru-1234');
    expect(await screen.findByTestId('cp-done')).toHaveTextContent('Kata sandi diganti');
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/auth/password')[0])).toEqual({
      currentPassword: 'sandi-lama-1234',
      newPassword: 'sandi-baru-1234',
    });
    expect(screen.getByTestId('cp-current')).toHaveValue('');
    expect(screen.getByTestId('cp-new')).toHaveValue('');
  });

  it('shows the server message for a 400 and the lock message for a 429', async () => {
    let status = 400;
    mockFetch('viewer', {
      'POST /api/v1/auth/password': () =>
        status === 400
          ? json(400, { error: 'validation_error', message: 'Kata sandi lama tidak cocok.', fields: ['currentPassword'] })
          : json(429, { error: 'too_many_attempts' }),
    });
    render(<ChangePasswordDialog onClose={() => undefined} />);
    await submit('salah', 'sandi-baru-1234');
    expect(await screen.findByTestId('cp-error')).toHaveTextContent('Kata sandi lama tidak cocok.');
    expect(screen.queryByTestId('cp-done')).not.toBeInTheDocument();
    status = 429;
    await userEvent.setup().click(screen.getByTestId('cp-submit'));
    await vi.waitFor(() => expect(screen.getByTestId('cp-error')).toHaveTextContent('Terlalu banyak percobaan'));
  });

  it('calls onClose from the Tutup button', async () => {
    mockFetch('viewer');
    const onClose = vi.fn();
    render(<ChangePasswordDialog onClose={onClose} />);
    await userEvent.setup().click(screen.getByTestId('cp-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
