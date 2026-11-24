import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BundleForm } from '../../src/screens/library/BundleForm';
import { bodyOf, callsTo, content, json, listItem, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

const STEPS = [
  listItem({ id: 'f1', name: 'Buka database' }),
  listItem({ id: 'f2', name: 'Masuk database' }),
  listItem({ id: 'f3', name: 'Jalankan query' }),
  listItem({ id: 'r1', name: 'Tutup koneksi', kind: 'rollback', missingRollback: false }),
  listItem({ id: 'r2', name: 'Pulihkan data', kind: 'rollback', missingRollback: false }),
];

function setup(props: Partial<Parameters<typeof BundleForm>[0]> = {}) {
  const handlers = { onSaved: vi.fn(), onCancel: vi.fn() };
  render(<BundleForm {...handlers} {...props} />);
  return handlers;
}

async function add(prefix: string, id: string) {
  await userEvent.selectOptions(await screen.findByTestId(`${prefix}-select`), id);
  await userEvent.click(screen.getByTestId(`${prefix}-add`));
}

describe('bundle form (Alur 5, BR2.11)', () => {
  it('offers only forward steps for the forward list and only rollback steps for the rollback list', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(200, STEPS) });
    setup();
    await screen.findByText(/Buka database/);
    const forwardNames = Array.from(screen.getByTestId('bundle-forward-select').querySelectorAll('option')).map((o) => o.textContent);
    const rollbackNames = Array.from(screen.getByTestId('bundle-rollback-select').querySelectorAll('option')).map((o) => o.textContent);
    expect(forwardNames.join('|')).toMatch(/Buka database.*Masuk database.*Jalankan query/);
    expect(forwardNames.join('|')).not.toMatch(/Tutup koneksi/);
    expect(rollbackNames.join('|')).toMatch(/Tutup koneksi.*Pulihkan data/);
    expect(rollbackNames.join('|')).not.toMatch(/Buka database/);
  });

  it('saves 3 forward steps and 2 rollback steps in the chosen order (counts may differ)', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, STEPS),
      'POST /api/v1/bundles': () => json(201, { id: 'b1', name: 'Buka DB', category: 'Database', forward: [], rollback: [] }),
    });
    const { onSaved } = setup();
    await userEvent.type(await screen.findByTestId('bundle-name-input'), 'Buka DB');
    await userEvent.selectOptions(screen.getByTestId('bundle-category-input'), 'Database');
    await add('bundle-forward', 'f1');
    await add('bundle-forward', 'f2');
    await add('bundle-forward', 'f3');
    await add('bundle-rollback', 'r2');
    await add('bundle-rollback', 'r1');
    expect(screen.getByTestId('bundle-counts')).toHaveTextContent('3 step forward, 2 step rollback');
    await userEvent.click(screen.getByTestId('bundle-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/bundles')[0] as never)).toEqual({
      name: 'Buka DB',
      category: 'Database',
      forwardStepIds: ['f1', 'f2', 'f3'],
      rollbackStepIds: ['r2', 'r1'],
    });
  });

  it('reorders with up/down and removes members, never offering a step twice', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(200, STEPS) });
    setup();
    await add('bundle-forward', 'f1');
    await add('bundle-forward', 'f2');
    await add('bundle-forward', 'f3');
    await userEvent.click(screen.getByTestId('bundle-forward-up-2'));
    const order = () => screen.getAllByTestId('bundle-forward-item').map((li) => li.textContent);
    expect(order()[1]).toContain('Jalankan query');
    expect(order()[2]).toContain('Masuk database');
    await userEvent.click(screen.getByTestId('bundle-forward-down-0'));
    expect(order()[0]).toContain('Jalankan query');
    await userEvent.click(screen.getByTestId('bundle-forward-up-0')); // already first: nothing happens
    expect(order()[0]).toContain('Jalankan query');
    await userEvent.click(screen.getByTestId('bundle-forward-remove-0'));
    expect(screen.getAllByTestId('bundle-forward-item')).toHaveLength(2);
    expect(screen.getByTestId('bundle-forward-select').textContent).toContain('Jalankan query'); // offered again
  });

  it('shows the server message and marks the list on a 400, keeping the draft', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, STEPS),
      'POST /api/v1/bundles': () =>
        json(400, { error: 'validation_error', message: 'Bundle butuh minimal satu step forward', fields: ['forwardStepIds'] }),
    });
    setup();
    await userEvent.type(await screen.findByTestId('bundle-name-input'), 'Kosong');
    await userEvent.click(screen.getByTestId('bundle-submit'));
    expect(await screen.findByTestId('bundle-error')).toHaveTextContent('minimal satu step forward');
    expect(screen.getByTestId('bundle-name-input')).toHaveValue('Kosong');
  });

  it('shows the message of a duplicate bundle name (409)', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, STEPS),
      'POST /api/v1/bundles': () =>
        json(409, { error: 'conflict', message: 'Bundle dengan nama "Buka DB" sudah ada', existing: { id: 'x' }, conflictOn: 'bundle' }),
    });
    setup();
    await userEvent.type(await screen.findByTestId('bundle-name-input'), 'Buka DB');
    await add('bundle-forward', 'f1');
    await userEvent.click(screen.getByTestId('bundle-submit'));
    expect(await screen.findByTestId('bundle-error')).toHaveTextContent('sudah ada');
  });

  it('edits an existing bundle with PATCH', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, STEPS),
      'PATCH /api/v1/bundles/b1': () => json(200, { id: 'b1' }),
    });
    const { onSaved } = setup({
      initial: {
        id: 'b1',
        name: 'Buka DB',
        category: null,
        forward: [content({ id: 'f1', name: 'Buka database' })],
        rollback: [],
      },
    });
    await add('bundle-rollback', 'r1');
    await userEvent.click(screen.getByTestId('bundle-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(bodyOf(callsTo(fetchMock, 'PATCH', '/api/v1/bundles/b1')[0] as never)).toEqual({
      name: 'Buka DB',
      category: null,
      forwardStepIds: ['f1'],
      rollbackStepIds: ['r1'],
    });
  });

  it('shows an error when the step list cannot be loaded, and cancel works', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(500, { error: 'internal_error', message: 'x' }) });
    const { onCancel } = setup();
    expect(await screen.findByTestId('bundle-error')).toHaveTextContent('Terjadi kesalahan pada server');
    await userEvent.click(screen.getByTestId('bundle-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
