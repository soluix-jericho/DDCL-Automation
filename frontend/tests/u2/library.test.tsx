import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_ERROR } from '../../src/api';
import { LibraryScreen } from '../../src/screens/LibraryScreen';
import { bodyOf, callsTo, content, json, listItem, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

const noop = () => undefined;

describe('Library list (AC1.2.1, AC1.3.2)', () => {
  it('shows name, category, kind and usage count per step, and the marker only where a rollback is missing', async () => {
    mockFetch({
      'GET /api/v1/steps': () =>
        json(200, [
          listItem({ id: 'a', name: 'Maju', usageCount: 3, missingRollback: true }),
          listItem({ id: 'b', name: 'Mundur', kind: 'rollback', missingRollback: false }),
          listItem({ id: 'c', name: 'Berpasangan', pairedRollbackStepId: 'b', missingRollback: false }),
        ]),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    const rows = await screen.findAllByTestId('step-item');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Maju');
    expect(rows[0]).toHaveTextContent('Database');
    expect(within(rows[0] as HTMLElement).getByTestId('step-usage')).toHaveTextContent('3');
    expect(within(rows[0] as HTMLElement).getByTestId('step-missing-rollback')).toHaveTextContent('Belum ada rollback');
    expect(within(rows[1] as HTMLElement).queryByTestId('step-missing-rollback')).not.toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).queryByTestId('step-missing-rollback')).not.toBeInTheDocument();
  });

  it('lists bundles in their own section with member counts', async () => {
    mockFetch({
      'GET /api/v1/bundles': () => json(200, [{ id: 'b1', name: 'Buka DB', category: 'Database', forwardCount: 3, rollbackCount: 2 }]),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    const item = await screen.findByTestId('bundle-item');
    expect(within(screen.getByTestId('bundle-section')).getByTestId('bundle-item')).toBe(item);
    expect(item).toHaveTextContent('Buka DB');
    expect(item).toHaveTextContent('3 forward, 2 rollback');
  });

  it('shows an empty-library message, not an error', async () => {
    mockFetch({});
    render(<LibraryScreen onLibraryChanged={noop} />);
    expect(await screen.findByTestId('step-list-empty')).toHaveTextContent('Belum ada step');
    expect(screen.getByTestId('bundle-list-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('library-error')).not.toBeInTheDocument();
  });

  it('shows a generic message when loading fails', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(500, { error: 'internal_error', message: 'secret' }) });
    render(<LibraryScreen onLibraryChanged={noop} />);
    expect(await screen.findByTestId('library-error')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  });
});

describe('search and filter go to the server (BR2.13)', () => {
  it('sends q and category for steps and bundles, and shows "no match" as an empty list', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': (_i, url) =>
        json(200, url?.searchParams.get('q') === 'zzz' ? [] : [listItem({ name: 'Update Image' })]),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await screen.findByTestId('step-item');

    await userEvent.type(screen.getByTestId('library-search'), 'zzz');
    expect(await screen.findByTestId('step-list-empty')).toHaveTextContent('Tidak ada step yang cocok');
    expect(screen.queryByTestId('library-error')).not.toBeInTheDocument();
    const lastSteps = callsTo(fetchMock, 'GET', '/api/v1/steps').at(-1);
    expect(new URL(String(lastSteps?.[0])).searchParams.get('q')).toBe('zzz');
    const lastBundles = callsTo(fetchMock, 'GET', '/api/v1/bundles').at(-1);
    expect(new URL(String(lastBundles?.[0])).searchParams.get('q')).toBe('zzz');

    await userEvent.selectOptions(screen.getByTestId('library-category-filter'), 'Bastion');
    await waitFor(() => {
      const last = callsTo(fetchMock, 'GET', '/api/v1/steps').at(-1);
      expect(new URL(String(last?.[0])).searchParams.get('category')).toBe('Bastion');
    });
  });

  it('keeps the newest result when responses arrive out of order', async () => {
    let releaseSlow!: () => void;
    const slow = new Promise<void>((r) => (releaseSlow = r));
    mockFetch({
      'GET /api/v1/steps': async (_i, url) => {
        if (url?.searchParams.get('q') === 'a') {
          await slow;
          return json(200, [listItem({ name: 'Hasil lama' })]);
        }
        return json(200, [listItem({ name: 'Hasil baru' })]);
      },
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await screen.findByText('Hasil baru'); // initial load (q empty)
    await userEvent.type(screen.getByTestId('library-search'), 'a'); // slow request
    await userEvent.type(screen.getByTestId('library-search'), 'b'); // newer request ("ab")
    await screen.findByText('Hasil baru');
    releaseSlow();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Hasil lama')).not.toBeInTheDocument();
  });
});

describe('editing and bundles from the list', () => {
  it('opens the form filled with the current step and says old DDCLs stay unchanged', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [listItem()]),
      'GET /api/v1/steps/s1': () => json(200, content()),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-edit'));
    expect(await screen.findByTestId('step-name-input')).toHaveValue('Update Deployment');
    expect(screen.getByTestId('main-line-0-0')).toHaveValue('kubectl apply -f {file}');
    expect(screen.getByTestId('edit-note')).toHaveTextContent('tidak berubah');
    expect(screen.getByTestId('step-kind-input')).toBeDisabled();
  });

  it('tells the user a step vanished (404) and refreshes the list', async () => {
    const onChanged = vi.fn();
    mockFetch({
      'GET /api/v1/steps': () => json(200, [listItem()]),
      'GET /api/v1/steps/s1': () => json(404, { error: 'not_found', message: 'x' }),
    });
    render(<LibraryScreen onLibraryChanged={onChanged} />);
    await userEvent.click(await screen.findByTestId('step-edit'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('Step sudah tidak ada');
    expect(onChanged).toHaveBeenCalled();
  });

  it('deletes a bundle without touching steps and reports it', async () => {
    const del = vi.fn(() => json(200, { id: 'b1' }));
    const onChanged = vi.fn();
    const fetchMock = mockFetch({
      'GET /api/v1/bundles': () => json(200, [{ id: 'b1', name: 'Buka DB', category: null, forwardCount: 1, rollbackCount: 0 }]),
      'DELETE /api/v1/bundles/b1': del,
    });
    render(<LibraryScreen onLibraryChanged={onChanged} />);
    await userEvent.click(await screen.findByTestId('bundle-delete'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('Step di dalamnya tidak ikut terhapus');
    expect(callsTo(fetchMock, 'DELETE', '/api/v1/bundles/b1')).toHaveLength(1);
    expect(onChanged).toHaveBeenCalled();
  });

  it('opens an existing bundle for editing', async () => {
    mockFetch({
      'GET /api/v1/bundles': () => json(200, [{ id: 'b1', name: 'Buka DB', category: 'Database', forwardCount: 1, rollbackCount: 1 }]),
      'GET /api/v1/bundles/b1': () =>
        json(200, {
          id: 'b1',
          name: 'Buka DB',
          category: 'Database',
          forward: [content({ id: 'f1', name: 'F1' })],
          rollback: [content({ id: 'r1', name: 'R1', kind: 'rollback' })],
        }),
      'GET /api/v1/steps': () =>
        json(200, [listItem({ id: 'f1', name: 'F1' }), listItem({ id: 'r1', name: 'R1', kind: 'rollback' })]),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('bundle-edit'));
    expect(await screen.findByTestId('bundle-name-input')).toHaveValue('Buka DB');
    expect(screen.getByTestId('bundle-counts')).toHaveTextContent('1 step forward, 1 step rollback');
  });

  it('saves a new step through the form and refreshes both the list and other screens', async () => {
    const onChanged = vi.fn();
    let saved = false;
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, saved ? [listItem({ name: 'Baru' })] : []),
      'POST /api/v1/steps': () => {
        saved = true;
        return json(201, content({ name: 'Baru' }));
      },
    });
    render(<LibraryScreen onLibraryChanged={onChanged} />);
    await userEvent.click(await screen.findByTestId('step-new'));
    await userEvent.type(screen.getByTestId('step-name-input'), 'Baru');
    await userEvent.selectOptions(screen.getByTestId('step-category-input'), 'Database');
    await userEvent.type(screen.getByTestId('main-line-0-0'), 'langkah satu');
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('step-item')).toHaveTextContent('Baru');
    expect(screen.getByTestId('library-notice')).toHaveTextContent('Step "Baru" disimpan');
    expect(onChanged).toHaveBeenCalled();
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never)).toMatchObject({
      name: 'Baru',
      kind: 'forward',
    });
  });
});
