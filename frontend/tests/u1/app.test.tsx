import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { GENERIC_ERROR } from '../../src/api';

type Handler = (init?: RequestInit) => Response | Promise<Response>;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Routes fetch calls by "METHOD path"; unknown routes fail the test loudly. */
function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const STEP = { id: 's1', name: 'Update Image', category: 'Image', kind: 'forward', pairedRollbackStepId: null };
const DDCL = { id: 'd1', title: 'T', status: 'Draft', createdBy: 'dev-user', tabLabel: '2026-10-26' };

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('Library screen', () => {
  it('shows which fields are empty when the server rejects the step (AC1.1.1/AC1.1.3)', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, []),
      'POST /api/v1/steps': () =>
        json(400, { error: 'validation_error', message: 'x', fields: ['name', 'category'] }),
    });
    render(<App />);
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('error-name')).toBeInTheDocument();
    expect(screen.getByTestId('error-category')).toBeInTheDocument();
  });

  it('shows only the empty field when just one is missing', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, []),
      'POST /api/v1/steps': () =>
        json(400, { error: 'validation_error', message: 'x', fields: ['category'] }),
    });
    render(<App />);
    await userEvent.type(screen.getByTestId('step-name-input'), 'Update Image');
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('error-category')).toBeInTheDocument();
    expect(screen.queryByTestId('error-name')).not.toBeInTheDocument();
  });

  it('adds a created step to the list and sends credentials (session cookie)', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, []),
      'POST /api/v1/steps': () => json(201, STEP),
    });
    render(<App />);
    await userEvent.type(screen.getByTestId('step-name-input'), 'Update Image');
    await userEvent.type(screen.getByTestId('step-category-input'), 'Image');
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('step-item')).toHaveTextContent('Update Image');
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[1]).toMatchObject({ credentials: 'include' });
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ name: 'Update Image', category: 'Image' });
  });

  it('shows a generic message on a 500 and does not retry the POST', async () => {
    const post = vi.fn(() => json(500, { error: 'internal_error', message: 'db host 10.0.0.1 down' }));
    mockFetch({ 'GET /api/v1/steps': () => json(200, []), 'POST /api/v1/steps': post });
    render(<App />);
    await userEvent.type(screen.getByTestId('step-name-input'), 'A');
    await userEvent.type(screen.getByTestId('step-category-input'), 'B');
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('library-error')).toHaveTextContent(GENERIC_ERROR);
    expect(screen.queryByText(/10\.0\.0\.1/)).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('shows a generic message when the backend is unreachable', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, []),
      'POST /api/v1/steps': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    render(<App />);
    await userEvent.click(screen.getByTestId('step-submit'));
    expect(await screen.findByTestId('library-error')).toHaveTextContent(GENERIC_ERROR);
  });
});

describe('Compose screen', () => {
  it('tab label follows the header date (BR1.7)', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(200, [STEP]) });
    render(<App />);
    await userEvent.click(screen.getByTestId('tab-compose'));
    expect(screen.getByTestId('tab-label')).toHaveTextContent('DDCL baru');
    fireEvent.change(screen.getByTestId('header-date-input'), { target: { value: '2026-10-26' } });
    expect(screen.getByTestId('tab-label')).toHaveTextContent('2026-10-26');
    fireEvent.change(screen.getByTestId('header-date-input'), { target: { value: '2026-11-02' } });
    expect(screen.getByTestId('tab-label')).toHaveTextContent('2026-11-02');
  });

  it('creates a DDCL, then adds the chosen step with its parameter value', async () => {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, [STEP]),
      'POST /api/v1/ddcls': () => json(201, DDCL),
      'POST /api/v1/ddcls/d1/checklist-items': () =>
        json(201, { id: 'c1', order: 1, stepId: 's1', parameterValues: { image: 'a:1' } }),
    });
    render(<App />);
    await screen.findByTestId('step-item');
    await userEvent.click(screen.getByTestId('tab-compose'));
    await userEvent.type(screen.getByTestId('ddcl-title-input'), 'T');
    fireEvent.change(screen.getByTestId('header-date-input'), { target: { value: '2026-10-26' } });
    await userEvent.click(screen.getByTestId('ddcl-submit'));
    expect(await screen.findByTestId('ddcl-created')).toHaveTextContent('Draft');
    expect(screen.getByTestId('tab-label')).toHaveTextContent('2026-10-26');

    await userEvent.selectOptions(screen.getByTestId('checklist-step-select'), 's1');
    await userEvent.type(screen.getByTestId('param-name-input'), 'image');
    await userEvent.type(screen.getByTestId('param-value-input'), 'a:1');
    await userEvent.click(screen.getByTestId('checklist-add'));
    expect(await screen.findByTestId('checklist-added')).toBeInTheDocument();

    const ddclCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/api/v1/ddcls'));
    expect(JSON.parse(String(ddclCall?.[1]?.body))).toEqual({
      title: 'T',
      releaseHeader: { date: '2026-10-26' },
    });
    const itemCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/checklist-items'));
    expect(JSON.parse(String(itemCall?.[1]?.body))).toEqual({
      stepId: 's1',
      parameterValues: { image: 'a:1' },
    });
  });

  it('disables adding to the checklist until a step is chosen', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, [STEP]),
      'POST /api/v1/ddcls': () => json(201, DDCL),
    });
    render(<App />);
    await userEvent.click(screen.getByTestId('tab-compose'));
    await userEvent.type(screen.getByTestId('ddcl-title-input'), 'T');
    await userEvent.click(screen.getByTestId('ddcl-submit'));
    expect(await screen.findByTestId('checklist-add')).toBeDisabled();
  });

  it('shows the server validation message when DDCL creation is rejected', async () => {
    mockFetch({
      'GET /api/v1/steps': () => json(200, []),
      'POST /api/v1/ddcls': () =>
        json(400, { error: 'validation_error', message: 'Field wajib belum diisi: title', fields: ['title'] }),
    });
    render(<App />);
    await userEvent.click(screen.getByTestId('tab-compose'));
    await userEvent.click(screen.getByTestId('ddcl-submit'));
    expect(await screen.findByTestId('compose-error')).toHaveTextContent('title');
  });
});

describe('Export screen', () => {
  async function reachExport(exportHandler: Handler) {
    const fetchMock = mockFetch({
      'GET /api/v1/steps': () => json(200, [STEP]),
      'POST /api/v1/ddcls': () => json(201, DDCL),
      'POST /api/v1/ddcls/d1/checklist-items': () =>
        json(201, { id: 'c1', order: 1, stepId: 's1', parameterValues: null }),
      'GET /api/v1/ddcls/d1/export': exportHandler,
    });
    render(<App />);
    await screen.findByTestId('step-item');
    await userEvent.click(screen.getByTestId('tab-compose'));
    await userEvent.type(screen.getByTestId('ddcl-title-input'), 'T');
    await userEvent.click(screen.getByTestId('ddcl-submit'));
    await userEvent.selectOptions(await screen.findByTestId('checklist-step-select'), 's1');
    await userEvent.click(screen.getByTestId('checklist-add'));
    await screen.findByTestId('checklist-added');
    await userEvent.click(screen.getByTestId('tab-export'));
    return fetchMock;
  }

  it('asks the user to build a DDCL first when none exists', async () => {
    mockFetch({ 'GET /api/v1/steps': () => json(200, []) });
    render(<App />);
    await userEvent.click(screen.getByTestId('tab-export'));
    expect(screen.getByTestId('export-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('export-download')).not.toBeInTheDocument();
  });

  it('download button calls the export endpoint and triggers a file download', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const fetchMock = await reachExport(
      () =>
        new Response(new Blob(['xlsx-bytes']), {
          status: 200,
          headers: { 'Content-Disposition': 'attachment; filename="DDCL-d1.xlsx"' },
        }),
    );
    await userEvent.click(screen.getByTestId('export-download'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/api/v1/ddcls/d1/export'));
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ credentials: 'include' });
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });

  it('shows a generic message when the export fails with 500', async () => {
    await reachExport(() => json(500, { error: 'internal_error', message: 'secret detail' }));
    await userEvent.click(screen.getByTestId('export-download'));
    expect(await screen.findByTestId('export-error')).toHaveTextContent(GENERIC_ERROR);
  });

  it('shows the explicit template message when the template is unavailable', async () => {
    await reachExport(() =>
      json(500, { error: 'template_unavailable', message: 'Template Excel tidak dapat dimuat. Path: /x' }),
    );
    await userEvent.click(screen.getByTestId('export-download'));
    expect(await screen.findByTestId('export-error')).toHaveTextContent('Template Excel tidak dapat dimuat');
  });
});
