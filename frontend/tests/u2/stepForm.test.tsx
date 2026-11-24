import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUSY_MESSAGE } from '../../src/api';
import { StepForm } from '../../src/screens/library/StepForm';
import { bodyOf, callsTo, content, json, listItem, mockFetch } from './mock';

beforeEach(() => {
  vi.unstubAllGlobals();
});

function setup(props: Partial<Parameters<typeof StepForm>[0]> = {}) {
  const handlers = { onSaved: vi.fn(), onUseExisting: vi.fn(), onCancel: vi.fn() };
  render(<StepForm {...handlers} {...props} />);
  return handlers;
}

/** user-event treats "{" as a key descriptor, so text with braces is set directly. */
const setLine = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

async function fillBasics(name = 'Update Deployment') {
  await userEvent.type(screen.getByTestId('step-name-input'), name);
  await userEvent.selectOptions(screen.getByTestId('step-category-input'), 'Database');
  setLine('main-line-0-0', 'kubectl apply');
}

describe('new step form (BR2.2, AC1.1.3)', () => {
  it('starts with three empty numbered columns', () => {
    mockFetch({});
    setup();
    expect(screen.getAllByTestId('main-column')).toHaveLength(3);
    expect(screen.getByTestId('main-line-0-0')).toHaveValue('');
    expect(screen.getByTestId('step-form')).toHaveTextContent('1.');
  });

  it('adds a column and a numbered step line with the buttons', async () => {
    mockFetch({});
    setup();
    await userEvent.click(screen.getByTestId('main-column-add'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(4);
    await userEvent.click(screen.getByTestId('main-line-add-0'));
    expect(screen.getByTestId('main-line-0-1')).toBeInTheDocument();
    expect(within(screen.getAllByTestId('main-column')[0] as HTMLElement).getByText('2.')).toBeInTheDocument();
  });

  it('removes an empty column at once, but asks first when the column has steps (and says how many)', async () => {
    mockFetch({});
    setup();
    await userEvent.click(screen.getByTestId('main-column-remove-2'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(2);

    setLine('main-line-0-0', 'satu');
    await userEvent.click(screen.getByTestId('main-line-add-0'));
    setLine('main-line-0-1', 'dua');
    await userEvent.click(screen.getByTestId('main-column-remove-0'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(2); // nothing lost yet
    expect(screen.getByTestId('main-column-remove-confirm-0')).toHaveTextContent('2 langkah');
    await userEvent.click(within(screen.getByTestId('main-column-remove-confirm-0')).getByText('Batal'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(2);

    await userEvent.click(screen.getByTestId('main-column-remove-0'));
    await userEvent.click(screen.getByTestId('main-column-remove-yes-0'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(1);
  });

  it('refuses to remove the last column', async () => {
    mockFetch({});
    setup();
    await userEvent.click(screen.getByTestId('main-column-remove-2'));
    await userEvent.click(screen.getByTestId('main-column-remove-1'));
    await userEvent.click(screen.getByTestId('main-column-remove-0'));
    expect(screen.getAllByTestId('main-column')).toHaveLength(1);
    expect(screen.getByTestId('main-columns-message')).toHaveTextContent('minimal punya satu kolom');
  });

  it('lists the {variables} found in the steps while typing, ignoring escaped braces', () => {
    mockFetch({});
    setup();
    expect(screen.getByTestId('variables-detected')).toHaveTextContent('Tidak ada variabel');
    setLine('main-line-0-0', 'ping {host} {{literal}} {port}');
    setLine('main-line-1-0', 'cek {host}');
    expect(screen.getAllByTestId('variable-chip').map((c) => c.textContent)).toEqual(['{host}', '{port}']);
  });

  it('renders step text as plain text, never as HTML (NFR2.8)', () => {
    mockFetch({});
    setup({ initial: content({ columns: [{ label: null, lines: ['<img src=x onerror=alert(1)>'] }] }) });
    expect(screen.getByTestId('main-line-0-0')).toHaveValue('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('attachments (BR2.5)', () => {
  it('adds, fills and removes attachments and sends the filled ones', async () => {
    const fetchMock = mockFetch({ 'POST /api/v1/steps': () => json(201, content()) });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('attachment-add'));
    await userEvent.type(screen.getByTestId('attachment-name-0'), 'deploy.yaml');
    setLine('attachment-content-0', 'kind: Pod\nspec: {}');
    await userEvent.click(screen.getByTestId('attachment-add'));
    await userEvent.click(screen.getByTestId('attachment-remove-1'));
    await userEvent.click(screen.getByTestId('step-submit'));
    await screen.findByTestId('step-form');
    const body = bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never);
    expect(body.attachments).toEqual([{ filename: 'deploy.yaml', content: 'kind: Pod\nspec: {}' }]);
  });
});

describe('rollback pair (BR2.9, AC1.3.1)', () => {
  const rollbacks = [listItem({ id: 'r1', name: 'Balik 1', kind: 'rollback', missingRollback: false })];

  it('skipping the pair sends pairedRollbackStepId null', async () => {
    const fetchMock = mockFetch({ 'POST /api/v1/steps': () => json(201, content()) });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(1));
    const body = bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never);
    expect(body).toMatchObject({ kind: 'forward', pairedRollbackStepId: null });
    expect(body).not.toHaveProperty('rollbackStep');
  });

  it('pairs with an existing rollback step chosen from the Library', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, [...rollbacks, listItem({ id: 'f9', name: 'Maju lain' })]),
      'POST /api/v1/steps': () => json(201, content()),
    });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('pair-existing'));
    const select = screen.getByTestId('pair-select');
    await within(select).findByText(/Balik 1/);
    expect(within(select).queryByText(/Maju lain/)).not.toBeInTheDocument(); // only rollback steps are offered
    await userEvent.selectOptions(select, 'r1');
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never)).toMatchObject({ pairedRollbackStepId: 'r1' });
  });

  it('creates a new rollback step inline, in the same request', async () => {
    const fetchMock = mockFetch({ 'POST /api/v1/steps': () => json(201, content()) });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('pair-new'));
    await userEvent.type(screen.getByTestId('rb-name-input'), 'Balikkan Deployment');
    setLine('rb-line-0-0', 'kubectl rollout undo');
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(1));
    const body = bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never);
    expect(body).not.toHaveProperty('pairedRollbackStepId');
    expect(body.rollbackStep).toMatchObject({
      name: 'Balikkan Deployment',
      category: 'Database',
      kind: 'rollback',
      columns: [{ label: null, lines: ['kubectl rollout undo'] }],
    });
  });

  it('hides the pair section for a rollback step and sends no pair', async () => {
    const fetchMock = mockFetch({ 'POST /api/v1/steps': () => json(201, content({ kind: 'rollback' })) });
    setup();
    await userEvent.selectOptions(screen.getByTestId('step-kind-input'), 'rollback');
    expect(screen.queryByTestId('pair-section')).not.toBeInTheDocument();
    await fillBasics('Undo');
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(1));
    const body = bodyOf(callsTo(fetchMock, 'POST', '/api/v1/steps')[0] as never);
    expect(body.kind).toBe('rollback');
    expect(body).not.toHaveProperty('pairedRollbackStepId');
  });
});

describe('saving (AC1.1.1, NFR3.4)', () => {
  it('marks the fields the server rejected and keeps what was typed', async () => {
    mockFetch({
      'POST /api/v1/steps': () =>
        json(400, {
          error: 'validation_error',
          message: 'Kolom 1, langkah 1, karakter 3: kurung kurawal tidak sah.',
          fields: ['category', 'columns[0].lines[0]'],
        }),
    });
    setup();
    await userEvent.type(screen.getByTestId('step-name-input'), 'Update');
    setLine('main-line-0-0', 'x {}');
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('error-category')).toBeInTheDocument();
    expect(screen.queryByTestId('error-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('main-line-0-0')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('form-error')).toHaveTextContent('karakter 3');
    expect(screen.getByTestId('step-name-input')).toHaveValue('Update');
    expect(screen.getByTestId('main-line-0-0')).toHaveValue('x {}');
  });

  it('edits with PATCH, sends the pair as null to clear it, and cannot change the kind', async () => {
    const onSaved = vi.fn();
    const fetchMock = mockFetch({ 'PATCH /api/v1/steps/s1': () => json(200, content({ name: 'Diubah' })) });
    setup({ initial: content({ pairedRollbackStepId: null }), onSaved });
    expect(screen.getByTestId('step-kind-input')).toBeDisabled();
    await userEvent.clear(screen.getByTestId('step-name-input'));
    await userEvent.type(screen.getByTestId('step-name-input'), 'Diubah');
    await userEvent.click(screen.getByTestId('step-submit'));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = bodyOf(callsTo(fetchMock, 'PATCH', '/api/v1/steps/s1')[0] as never);
    expect(body).toMatchObject({ name: 'Diubah', pairedRollbackStepId: null, kind: 'forward' });
  });

  it('shows the "busy" message on 503, keeps the draft and does not retry by itself', async () => {
    const post = vi.fn(() => json(503, { error: 'service_busy', message: 'x' }, { 'Retry-After': '2' }));
    mockFetch({ 'POST /api/v1/steps': post });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent(BUSY_MESSAGE);
    await new Promise((r) => setTimeout(r, 2500)); // longer than the Retry-After the server sent
    expect(post).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('step-name-input')).toHaveValue('Update Deployment');
    expect(screen.getByTestId('step-submit')).toBeEnabled(); // the user may try again by hand
  }, 10000);

  it('shows the "try again" message of a 409 retry and keeps the draft', async () => {
    mockFetch({
      'POST /api/v1/steps': () => json(409, { error: 'retry', message: 'Penyimpanan bentrok. Coba simpan lagi.' }),
    });
    setup();
    await fillBasics();
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('Coba simpan lagi');
    expect(screen.getByTestId('step-name-input')).toHaveValue('Update Deployment');
  });

  it('cancel calls onCancel without a request', async () => {
    const fetchMock = mockFetch({});
    const { onCancel } = setup();
    await userEvent.click(screen.getByTestId('step-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(callsTo(fetchMock, 'POST', '/api/v1/steps')).toHaveLength(0);
  });
});
