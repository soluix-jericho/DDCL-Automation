import { vi } from 'vitest';
import type { StepContent, StepListItem } from '../../src/api';

export type Handler = (init?: RequestInit, url?: URL) => Response | Promise<Response>;

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Routes fetch calls by "METHOD path" (query string ignored; the handler gets the URL when it needs it).
 * Unknown routes fail the test loudly. Library list endpoints default to empty lists.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const all: Record<string, Handler> = {
    'GET /api/v1/steps': () => json(200, []),
    'GET /api/v1/bundles': () => json(200, []),
    ...routes,
  };
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    const handler = all[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    return handler(init, url);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function callsTo(fn: ReturnType<typeof mockFetch>, method: string, path: string) {
  return fn.mock.calls.filter(
    ([input, init]) => (init?.method ?? 'GET') === method && new URL(String(input)).pathname === path,
  );
}

export function bodyOf(call: Parameters<typeof fetch> | undefined): Record<string, unknown> {
  return JSON.parse(String(call?.[1]?.body));
}

export function listItem(over: Partial<StepListItem> = {}): StepListItem {
  return {
    id: 's1',
    name: 'Update Deployment',
    category: 'Database',
    kind: 'forward',
    pairedRollbackStepId: null,
    columnCount: 1,
    attachmentCount: 0,
    usageCount: 0,
    missingRollback: true,
    ...over,
  };
}

export function content(over: Partial<StepContent> = {}): StepContent {
  return {
    id: 's1',
    name: 'Update Deployment',
    category: 'Database',
    kind: 'forward',
    pairedRollbackStepId: null,
    columns: [{ label: 'Utama', lines: ['kubectl apply -f {file}'] }],
    attachments: [],
    variables: ['file'],
    ...over,
  };
}
