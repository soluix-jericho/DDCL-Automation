export interface Step {
  id: string;
  name: string;
  category: string;
  kind: 'forward' | 'rollback';
  pairedRollbackStepId: string | null;
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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fields: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

async function readError(res: Response): Promise<ApiError> {
  let body: { error?: string; message?: string; fields?: string[] } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body: fall through to defaults */
  }
  if (res.status >= 500) {
    // BR1.5: generic message only, except for the explicit template error that tells the operator what to fix.
    const message = body.error === 'template_unavailable' && body.message ? body.message : GENERIC_ERROR;
    return new ApiError(message, res.status);
  }
  return new ApiError(body.message ?? 'Permintaan tidak valid.', res.status, body.fields ?? []);
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

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// No automatic retry on POST (a retry could duplicate data).
export async function listSteps(): Promise<Step[]> {
  return (await request('/api/v1/steps')).json();
}

export async function createStep(input: { name: string; category: string }): Promise<Step> {
  return (await request('/api/v1/steps', json(input))).json();
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
