export interface Step {
  id: string;
  name: string;
  category: string;
  kind: 'forward' | 'rollback';
  pairedRollbackStepId: string | null;
}

/** BR2.12: fixed list, labels only. */
export const CATEGORIES = ['Database', 'Bastion', 'RabbitMQ', 'Keycloak'] as const;
export type Category = (typeof CATEGORIES)[number];

/** One row of GET /steps: a summary, never step text (NFR1.11). */
export interface StepListItem extends Step {
  columnCount: number;
  attachmentCount: number;
  usageCount: number;
  /** BR2.10: forward step without a rollback partner. */
  missingRollback: boolean;
}

export interface StepColumnData {
  label: string | null;
  lines: string[];
}

export interface AttachmentData {
  filename: string;
  content: string;
}

/** Full step (GET /steps/{id}); `variables` is derived on the server and read-only. */
export interface StepContent extends Step {
  columns: StepColumnData[];
  attachments: AttachmentData[];
  variables: string[];
}

export interface StepDraftBase {
  name: string;
  category: string;
  columns: StepColumnData[];
  attachments: AttachmentData[];
}

/** Body of POST/PATCH /steps. pairedRollbackStepId null clears the pair; rollbackStep creates one atomically. */
export interface StepDraft extends StepDraftBase {
  kind: 'forward' | 'rollback';
  pairedRollbackStepId?: string | null;
  rollbackStep?: StepDraftBase & { kind: 'rollback' };
}

export interface NamedRef {
  id: string;
  name: string;
}

/** BR2.7: what deleting a step will do (GET /steps/{id}/impact) or did (DELETE). */
export interface DeleteImpact {
  usageCount: number;
  checklistItems: number;
  bundlesRemoved: NamedRef[];
  bundlesChanged: NamedRef[];
  pairLost: NamedRef[];
}

export interface BundleListItem {
  id: string;
  name: string;
  category: string | null;
  forwardCount: number;
  rollbackCount: number;
}

export interface BundleDetail {
  id: string;
  name: string;
  category: string | null;
  forward: StepContent[];
  rollback: StepContent[];
}

export interface BundleDraft {
  name: string;
  category: string | null;
  forwardStepIds: string[];
  rollbackStepIds: string[];
}

export interface ListParams {
  q?: string;
  category?: string;
}

export interface ReleaseHeaderInput {
  date?: string;
  startDate?: string;
  impactedSystem?: string;
  environment?: string;
  phaseRelease?: string;
  releaseObjective?: string;
  technicalChange?: string;
}

export interface Ddcl {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  tabLabel: string;
}

export interface ChecklistItem {
  id: string;
  order: number;
  stepId: string;
  parameterValues: Record<string, string> | null;
}

export const GENERIC_ERROR = 'Terjadi kesalahan pada server. Silakan coba lagi.';

export const BUSY_MESSAGE = 'Server sedang sibuk. Coba lagi sebentar lagi.';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: string[] = [],
    /** 409 name clash: the full step or bundle that already exists, and which part of the request clashed. */
    public readonly existing: unknown = null,
    public readonly conflictOn: 'step' | 'rollbackStep' | 'bundle' | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

async function readError(res: Response): Promise<ApiError> {
  let body: {
    error?: string;
    message?: string;
    fields?: string[];
    existing?: unknown;
    conflictOn?: 'step' | 'rollbackStep' | 'bundle';
  } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body: fall through to defaults */
  }
  if (res.status === 503 && body.error === 'service_busy') {
    // Overload protection: say so, and never retry on our own (a retried write could duplicate data).
    return new ApiError(BUSY_MESSAGE, 503);
  }
  if (res.status >= 500) {
    // BR1.5: generic message only, except for the explicit template error that tells the operator what to fix.
    const message = body.error === 'template_unavailable' && body.message ? body.message : GENERIC_ERROR;
    return new ApiError(message, res.status);
  }
  return new ApiError(
    body.message ?? 'Permintaan tidak valid.',
    res.status,
    body.fields ?? [],
    body.existing ?? null,
    body.conflictOn ?? null,
  );
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, { credentials: 'include', ...init });
  } catch {
    throw new ApiError(GENERIC_ERROR, 0);
  }
  if (!res.ok) throw await readError(res);
  return res;
}

function json(body: unknown, method = 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function query(params: ListParams): string {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.category) usp.set('category', params.category);
  const s = usp.toString();
  return s ? `?${s}` : '';
}

// No automatic retry on any write, 503 included (a retried write could duplicate data).
export async function listSteps(params: ListParams = {}): Promise<StepListItem[]> {
  return (await request(`/api/v1/steps${query(params)}`)).json();
}

export async function getStep(id: string): Promise<StepContent> {
  return (await request(`/api/v1/steps/${encodeURIComponent(id)}`)).json();
}

export async function createStep(input: StepDraft): Promise<StepContent> {
  return (await request('/api/v1/steps', json(input))).json();
}

export async function updateStep(id: string, input: StepDraft): Promise<StepContent> {
  return (await request(`/api/v1/steps/${encodeURIComponent(id)}`, json(input, 'PATCH'))).json();
}

export async function getStepImpact(id: string): Promise<DeleteImpact> {
  return (await request(`/api/v1/steps/${encodeURIComponent(id)}/impact`)).json();
}

export async function deleteStep(id: string): Promise<{ id: string; impact: DeleteImpact }> {
  return (await request(`/api/v1/steps/${encodeURIComponent(id)}`, { method: 'DELETE' })).json();
}

export async function listBundles(params: ListParams = {}): Promise<BundleListItem[]> {
  return (await request(`/api/v1/bundles${query(params)}`)).json();
}

export async function getBundle(id: string): Promise<BundleDetail> {
  return (await request(`/api/v1/bundles/${encodeURIComponent(id)}`)).json();
}

export async function createBundle(input: BundleDraft): Promise<BundleDetail> {
  return (await request('/api/v1/bundles', json(input))).json();
}

export async function updateBundle(id: string, input: BundleDraft): Promise<BundleDetail> {
  return (await request(`/api/v1/bundles/${encodeURIComponent(id)}`, json(input, 'PATCH'))).json();
}

export async function deleteBundle(id: string): Promise<void> {
  await request(`/api/v1/bundles/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function createDdcl(input: {
  title: string;
  releaseHeader: ReleaseHeaderInput;
}): Promise<Ddcl> {
  return (await request('/api/v1/ddcls', json(input))).json();
}

export async function addChecklistItem(
  ddclId: string,
  input: { stepId: string; parameterValues: Record<string, string> },
): Promise<ChecklistItem> {
  return (await request(`/api/v1/ddcls/${ddclId}/checklist-items`, json(input))).json();
}

export async function exportDdcl(ddclId: string): Promise<{ blob: Blob; fileName: string }> {
  const res = await request(`/api/v1/ddcls/${ddclId}/export`);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob: await res.blob(), fileName: match?.[1] ?? `DDCL-${ddclId}.xlsx` };
}
