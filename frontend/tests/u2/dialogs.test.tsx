import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryScreen } from '../../src/screens/LibraryScreen';
import { callsTo, content, json, listItem, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

const noop = () => undefined;

async function fillNewStep(name: string, line = 'kubectl apply') {
  await userEvent.click(await screen.findByTestId('step-new'));
  await userEvent.type(screen.getByTestId('step-name-input'), name);
  await userEvent.selectOptions(screen.getByTestId('step-category-input'), 'Database');
  fireEvent.change(screen.getByTestId('main-line-0-0'), { target: { value: line } });
}

describe('duplicate popup (AC1.1.2, BR2.3)', () => {
  const existing = content({
    id: 'old',
    name: 'Update Deployment',
    columns: [{ label: 'Lama', lines: ['langkah lama 1', 'langkah lama 2'] }],
    attachments: [{ filename: 'lama.yaml', content: 'a: 1' }],
  });

  function duplicateRoutes(on: 'step' | 'rollbackStep' = 'step') {
    return {
      'POST /api/v1/steps': () => json(409, { error: 'conflict', message: 'sudah ada', existing, conflictOn: on }),
    };
  }

  it('compares the existing step with what was just typed', async () => {
    mockFetch(duplicateRoutes());
    render(<LibraryScreen onLibraryChanged={noop} />);
    await fillNewStep('Update Deployment', 'langkah baru saya');
    await userEvent.click(screen.getByTestId('step-submit'));
    const dialog = await screen.findByTestId('duplicate-dialog');
    const old = within(within(dialog).getByTestId('dup-existing'));
    expect(old.getByText('langkah lama 1')).toBeInTheDocument();
    expect(old.getByText('langkah lama 2')).toBeInTheDocument();
    expect(old.getByText(/lama\.yaml/)).toBeInTheDocument();
    const typed = within(within(dialog).getByTestId('dup-typed'));
    expect(typed.getByText('langkah baru saya')).toBeInTheDocument();
    expect(within(dialog).getByTestId('dup-use-existing')).toBeInTheDocument();
    expect(within(dialog).getByTestId('dup-rename')).toBeInTheDocument();
  });

  it('"Ubah nama" closes the popup and keeps the whole draft', async () => {
    mockFetch(duplicateRoutes());
    render(<LibraryScreen onLibraryChanged={noop} />);
    await fillNewStep('Update Deployment', 'langkah baru saya');
    await userEvent.click(screen.getByTestId('step-submit'));
    await userEvent.click(await screen.findByTestId('dup-rename'));
    expect(screen.queryByTestId('duplicate-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('step-name-input')).toHaveValue('Update Deployment');
    expect(screen.getByTestId('main-line-0-0')).toHaveValue('langkah baru saya');
    await vi.waitFor(() => expect(screen.getByTestId('step-name-input')).toHaveFocus());
  });

  it('"Pakai step yang sudah ada" leaves the form and says which step is used', async () => {
    mockFetch(duplicateRoutes());
    render(<LibraryScreen onLibraryChanged={noop} />);
    await fillNewStep('Update Deployment');
    await userEvent.click(screen.getByTestId('step-submit'));
    await userEvent.click(await screen.findByTestId('dup-use-existing'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('Memakai step yang sudah ada: "Update Deployment"');
    expect(screen.queryByTestId('step-form')).not.toBeInTheDocument();
  });

  it('a clash on the inline rollback step offers to pair with the existing one instead', async () => {
    const rollbackExisting = content({ id: 'rb-old', name: 'Balikkan', kind: 'rollback' });
    const post = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return body.rollbackStep
        ? json(409, { error: 'conflict', message: 'sudah ada', existing: rollbackExisting, conflictOn: 'rollbackStep' })
        : json(201, content());
    });
    const fetchMock = mockFetch({ 'POST /api/v1/steps': post });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await fillNewStep('Maju');
    await userEvent.click(screen.getByTestId('pair-new'));
    await userEvent.type(screen.getByTestId('rb-name-input'), 'Balikkan');
    fireEvent.change(screen.getByTestId('rb-line-0-0'), { target: { value: 'undo' } });
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('duplicate-dialog')).toHaveTextContent('step rollback');
    await userEvent.click(screen.getByTestId('dup-use-existing'));
    expect(screen.getByTestId('pair-existing')).toBeChecked();
    expect(screen.getByTestId('pair-select')).toHaveValue('rb-old');
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(2));
    expect(JSON.parse(String(callsTo(fetchMock, 'POST', '/api/v1/steps')[1]?.[1]?.body))).toMatchObject({
      pairedRollbackStepId: 'rb-old',
    });
  });

  it('shows hostile step text from the existing step as plain text (NFR2.8)', async () => {
    const hostile = content({ name: 'X', columns: [{ label: null, lines: ['<img src=x onerror=alert(1)>'] }] });
    mockFetch({
      'POST /api/v1/steps': () => json(409, { error: 'conflict', message: 'x', existing: hostile, conflictOn: 'step' }),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await fillNewStep('X');
    await userEvent.click(screen.getByTestId('step-submit'));
    const dialog = await screen.findByTestId('duplicate-dialog');
    expect(within(dialog).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('delete dialog (AC1.2.2, BR2.7)', () => {
  const step = listItem({ id: 's1', name: 'Update Image', usageCount: 4 });
  const impact = {
    usageCount: 4,
    checklistItems: 5,
    bundlesRemoved: [{ id: 'b1', name: 'Bundle Satu' }],
    bundlesChanged: [{ id: 'b2', name: 'Bundle Dua' }],
    pairLost: [{ id: 'f1', name: 'Maju A' }],
  };

  it('shows usage, bundles that go with it and steps that lose their pair, and that old DDCLs stay intact', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, impact),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    expect(await screen.findByTestId('delete-usage')).toHaveTextContent('4 DDCL');
    expect(screen.getByTestId('delete-bundles-removed')).toHaveTextContent('Bundle Satu');
    expect(screen.getByTestId('delete-bundles-changed')).toHaveTextContent('Bundle Dua');
    expect(screen.getByTestId('delete-pair-lost')).toHaveTextContent('Maju A');
    expect(screen.getByTestId('delete-note')).toHaveTextContent('tetap utuh');
  });

  it('omits the bundle and pair lines when there is no such impact', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, { ...impact, bundlesRemoved: [], bundlesChanged: [], pairLost: [] }),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    await screen.findByTestId('delete-usage');
    expect(screen.queryByTestId('delete-bundles-removed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-pair-lost')).not.toBeInTheDocument();
  });

  it('deletes after confirmation, then refreshes the list and the other screens', async () => {
    const onChanged = vi.fn();
    let deleted = false;
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, deleted ? [] : [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, impact),
      'DELETE /api/v1/steps/s1': () => {
        deleted = true;
        return json(200, { id: 's1', impact });
      },
    });
    render(<LibraryScreen onLibraryChanged={onChanged} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    await screen.findByTestId('delete-usage');
    await userEvent.click(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('Step "Update Image" dihapus. DDCL yang memakainya tidak berubah.');
    expect(callsTo(fetchMock, 'DELETE', '/api/v1/steps/s1')).toHaveLength(1);
    expect(screen.queryByTestId('step-item')).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('cancel closes the dialog without deleting', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, impact),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    await screen.findByTestId('delete-usage');
    await userEvent.click(screen.getByTestId('delete-cancel'));
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    expect(callsTo(fetchMock, 'DELETE', '/api/v1/steps/s1')).toHaveLength(0);
  });

  it('treats a 404 on the impact preview or on delete as "already deleted" and refreshes', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(404, { error: 'not_found', message: 'x' }),
    });
    const { unmount } = render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('sudah tidak ada');
    unmount();

    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, impact),
      'DELETE /api/v1/steps/s1': () => json(404, { error: 'not_found', message: 'x' }),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    await screen.findByTestId('delete-usage');
    await userEvent.click(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('library-notice')).toHaveTextContent('sudah tidak ada');
  });

  it('shows a generic message when deleting fails and does not retry', async () => {
    const del = vi.fn(() => json(500, { error: 'internal_error', message: 'detail' }));
    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(200, impact),
      'DELETE /api/v1/steps/s1': del,
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    await screen.findByTestId('delete-usage');
    await userEvent.click(screen.getByTestId('delete-confirm'));
    expect(await screen.findByTestId('delete-error')).toHaveTextContent('Terjadi kesalahan pada server');
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('shows an error instead of loading forever when the impact cannot be read', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [step]),
      'GET /api/v1/steps/s1/impact': () => json(500, { error: 'internal_error', message: 'x' }),
    });
    render(<LibraryScreen onLibraryChanged={noop} />);
    await userEvent.click(await screen.findByTestId('step-delete'));
    expect(await screen.findByTestId('delete-error')).toBeInTheDocument();
    expect(screen.getByTestId('delete-confirm')).toBeDisabled();
  });
});
