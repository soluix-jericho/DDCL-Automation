import type { Prisma, PrismaClient } from '@prisma/client';
import { AuditCursor, AuditQuery, AuditType, EMAIL_MAX, encodeCursor } from './accountRules';

export type Db = PrismaClient | Prisma.TransactionClient;
export type WarnFn = (obj: Record<string, unknown>, msg: string) => void;

/** Never put passwords, tokens, hashes or cookies in here (BR4.20). `detail` is short free text. */
export interface AuditInput {
  type: AuditType;
  actorUserId?: string | null;
  targetUserId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  detail?: string | null;
}

export interface AuditRecord {
  id: string;
  occurredAt: string;
  type: AuditType;
  actorUserId: string | null;
  targetUserId: string | null;
  email: string | null;
  ipAddress: string | null;
  detail: string | null;
}

function data(ev: AuditInput) {
  return {
    type: ev.type,
    actorUserId: ev.actorUserId ?? null,
    targetUserId: ev.targetUserId ?? null,
    email: ev.email ? ev.email.slice(0, EMAIL_MAX) : null,
    ipAddress: ev.ipAddress ?? null,
    detail: ev.detail ? ev.detail.slice(0, 500) : null,
  };
}

/** In-transaction mode: a failure propagates and rolls the caller's change back (NFR3.23). */
export async function writeAudit(db: Db, ev: AuditInput): Promise<void> {
  await db.auditEvent.create({ data: data(ev) });
}

/** Best-effort mode: a failure is logged and never changes the answer to the client (NFR3.23). */
export async function writeAuditBestEffort(
  db: Db,
  ev: AuditInput,
  warn: WarnFn,
): Promise<void> {
  try {
    await writeAudit(db, ev);
  } catch (err) {
    warn({ err, auditType: ev.type }, 'audit write failed; continuing');
  }
}

/** Newest first, keyset cursor (occurredAt, id), no COUNT(*) (NFR1.23). */
export async function listAuditEvents(
  prisma: Db,
  q: AuditQuery,
): Promise<{ items: AuditRecord[]; nextCursor: string | null }> {
  const and: Prisma.AuditEventWhereInput[] = [];
  if (q.from) and.push({ occurredAt: { gte: q.from } });
  if (q.to) and.push({ occurredAt: { lt: q.to } });
  if (q.cursor) {
    const c: AuditCursor = q.cursor;
    and.push({
      OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }],
    });
  }
  const rows = await prisma.auditEvent.findMany({
    where: { ...(q.type ? { type: q.type } : {}), ...(and.length ? { AND: and } : {}) },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
  });
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() })),
    nextCursor:
      rows.length > q.limit && last ? encodeCursor({ occurredAt: last.occurredAt, id: last.id }) : null,
  };
}

export function createAuditRepository(prisma: PrismaClient) {
  return {
    listAuditEvents: (q: AuditQuery) => listAuditEvents(prisma, q),
  };
}
