import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditScreen } from '../../src/screens/AuditScreen';
import { auditEvent, callsTo, json, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

const query = (call: Parameters<typeof fetch> | undefined) => new URL(String(call?.[0])).searchParams;

describe('Audit screen (BR4.20)', () => {
  it('lists events in the order the server sends them and shows readable type labels', async () => {
    mockFetch('admin', {
      'GET /api/v1/audit-events': () =>
        json(200, {
          items: [auditEvent({ id: 'e2', type: 'login_locked' }), auditEvent({ id: 'e1', type: 'role_changed', detail: 'viewer -> editor' })],
          nextCursor: null,
        }),
    });
    render(<AuditScreen />);
    const items = await screen.findAllByTestId('audit-item');
    expect(items[0]).toHaveTextContent('Login terkunci');
    expect(items[1]).toHaveTextContent('Role diubah');
    expect(items[1]).toHaveTextContent('viewer -> editor');
    expect(screen.queryByTestId('audit-more')).not.toBeInTheDocument();
  });

  it('shows an empty message when there is nothing yet', async () => {
    mockFetch('admin', { 'GET /api/v1/audit-events': () => json(200, { items: [], nextCursor: null }) });
    render(<AuditScreen />);
    expect(await screen.findByTestId('audit-empty')).toBeInTheDocument();
  });

  it('applies the type and date filters on the server with the right parameters', async () => {
    const fetchMock = mockFetch('admin', {
      'GET /api/v1/audit-events': () => json(200, { items: [auditEvent()], nextCursor: null }),
    });
    render(<AuditScreen />);
    await screen.findAllByTestId('audit-item');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByTestId('audit-type'), 'login_failed');
    await user.type(screen.getByTestId('audit-from'), '2026-11-01');
    await user.type(screen.getByTestId('audit-to'), '2026-11-02');
    await user.click(screen.getByTestId('audit-apply'));
    await waitFor(() => expect(callsTo(fetchMock, 'GET', '/api/v1/audit-events')).toHaveLength(2));
    const params = query(callsTo(fetchMock, 'GET', '/api/v1/audit-events')[1]);
    expect(params.get('type')).toBe('login_failed');
    expect(params.get('from')).toBe('2026-11-01');
    expect(params.get('to')).toBe('2026-11-02');
    expect(params.get('cursor')).toBeNull();
  });

  it('"Muat lagi" asks for the next page with the cursor and appends it', async () => {
    const fetchMock = mockFetch('admin', {
      'GET /api/v1/audit-events': (_init, url) =>
        url?.searchParams.get('cursor') === 'CUR1'
          ? json(200, { items: [auditEvent({ id: 'e1', email: 'lama@example.test' })], nextCursor: null })
          : json(200, { items: [auditEvent({ id: 'e2', email: 'baru@example.test' })], nextCursor: 'CUR1' }),
    });
    render(<AuditScreen />);
    await screen.findAllByTestId('audit-item');
    await userEvent.setup().click(screen.getByTestId('audit-more'));
    await waitFor(() => expect(screen.getAllByTestId('audit-item')).toHaveLength(2));
    expect(query(callsTo(fetchMock, 'GET', '/api/v1/audit-events')[1]).get('cursor')).toBe('CUR1');
    expect(screen.queryByTestId('audit-more')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('audit-item')[1]).toHaveTextContent('lama@example.test');
  });

  it('shows an error when the server refuses (403) or rejects the filter (400)', async () => {
    mockFetch('admin', { 'GET /api/v1/audit-events': () => json(403, { error: 'forbidden' }) });
    render(<AuditScreen />);
    expect(await screen.findByTestId('audit-error')).toHaveTextContent('Hak akses tidak cukup');
  });
});
