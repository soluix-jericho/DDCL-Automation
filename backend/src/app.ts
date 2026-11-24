import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyServerOptions,
} from 'fastify';
import type { AppConfig } from './config';
import { Prisma } from '@prisma/client';
import {
  ConflictError,
  DatabaseUnavailable,
  NotFoundError,
  RetryExhausted,
  ServiceBusyError,
  TemplateUnavailable,
  ValidationError,
} from './errors';
import { exportDdclToXlsx } from './excel';
import type { Repository } from './repository';
import { registerLibraryRoutes } from './libraryRoutes';
import { tabLabel, validateChecklistInput, validateDdclInput } from './rules';
import { createWriteLimiter, WriteLimiter } from './writeLimiter';

export const SESSION_COOKIE = 'ddcl_session';
export const STUB_SESSION_VALUE = 'dev-session';
export const GENERIC_ERROR_MESSAGE = 'Terjadi kesalahan pada server. Silakan coba lagi.';
const BUSY_MESSAGE = 'Server sedang sibuk. Coba lagi sebentar lagi.';
export const XLSX_MIME ='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface BuildAppOptions {
  repo: Repository;
  config: AppConfig;
  /** Pino options or false to silence logs (tests). Default: JSON logs to stdout (OBS1.1). */
  logger?: Record<string, unknown> | boolean;
  /** Library write limiter; tests pass their own to observe slots. Default: 4 concurrent writes. */
  writeLimiter?: WriteLimiter;
}

const defaultLogger = {
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: { level: (label: string) => ({ level: label }) },
};

function logBoundaryError(
  request: FastifyRequest,
  err: unknown,
  operation: string,
  message: string,
): void {
  request.log.error({ err, operation, path: request.url, method: request.method }, message);
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { repo, config } = opts;
  const app = Fastify({
    logger: (opts.logger ?? defaultLogger) as FastifyServerOptions['logger'],
  });

  repo.setWarnSink((obj, msg) => app.log.warn(obj, msg));

  await app.register(cors, {
    origin: config.frontendOrigin,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });
  await app.register(cookie);

  // NFR2.1/NFR2.2: stub session cookie; this hook never rejects a request.
  app.addHook('onRequest', async (request, reply) => {
    try {
      if (!request.cookies?.[SESSION_COOKIE]) {
        reply.setCookie(SESSION_COOKIE, STUB_SESSION_VALUE, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        });
      }
    } catch (err) {
      request.log.warn({ err }, 'session cookie stub failed; continuing');
    }
  });

  // Central error handler (BR1.1, BR1.4, BR1.5, NFR3.2).
  app.setErrorHandler((err: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ValidationError) {
      return reply.code(400).send({ error: 'validation_error', message: err.message, fields: err.fields });
    }
    if (err instanceof NotFoundError) {
      return reply.code(404).send({ error: 'not_found', message: err.message });
    }
    if (err instanceof ConflictError) {
      request.log.info({ conflictOn: err.conflictOn, path: request.url }, 'Library name conflict');
      return reply
        .code(409)
        .send({ error: 'conflict', message: err.message, existing: err.existing, conflictOn: err.conflictOn });
    }
    if (err instanceof RetryExhausted) {
      request.log.warn({ path: request.url, method: request.method }, err.message);
      return reply.code(409).send({
        error: 'retry',
        message: 'Penyimpanan bentrok dengan perubahan lain. Coba simpan lagi.',
      });
    }
    if (err instanceof ServiceBusyError) {
      request.log.warn({ reason: err.reason, path: request.url }, 'Library request rejected: service busy');
      return reply
        .code(503)
        .header('Retry-After', String(err.retryAfterSeconds))
        .send({ error: 'service_busy', message: BUSY_MESSAGE });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        // A step (or other row) the request pointed at was deleted a moment ago.
        return reply.code(404).send({ error: 'not_found', message: 'Data yang dirujuk sudah tidak ada.' });
      }
      if (err.code === 'P2024') {
        request.log.warn({ reason: 'pool', path: request.url }, 'Library request rejected: pool exhausted');
        return reply
          .code(503)
          .header('Retry-After', '2')
          .send({ error: 'service_busy', message: BUSY_MESSAGE });
      }
    }
    if (err instanceof TemplateUnavailable) {
      logBoundaryError(request, err.originalCause ?? err, 'exportDdcl', 'Excel template unavailable');
      return reply.code(500).send({
        error: 'template_unavailable',
        message: `Template Excel tidak dapat dimuat. Path yang diharapkan: ${err.expectedPath}`,
      });
    }
    if (err instanceof DatabaseUnavailable) {
      logBoundaryError(request, err.originalCause, err.operation, 'Database unavailable');
      return reply.code(500).send({ error: 'internal_error', message: GENERIC_ERROR_MESSAGE });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 413) {
      return reply.code(413).send({ error: 'payload_too_large', message: 'Data yang dikirim terlalu besar.' });
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send({ error: 'bad_request', message: 'Permintaan tidak valid.' });
    }
    logBoundaryError(request, err, 'unhandled', 'Unexpected error');
    return reply.code(500).send({ error: 'internal_error', message: GENERIC_ERROR_MESSAGE });
  });

  app.get('/health', async (request, reply) => {
    try {
      await repo.ping();
      return { status: 'ok' };
    } catch (err) {
      logBoundaryError(request, err instanceof DatabaseUnavailable ? err.originalCause : err, 'health', 'Health check failed');
      return reply.code(503).send({ status: 'unhealthy' });
    }
  });

  await app.register(
    async (api) => {
      registerLibraryRoutes(api, { repo, limiter: opts.writeLimiter ?? createWriteLimiter() });

      api.post('/ddcls', async (request, reply) => {
        const input = validateDdclInput(request.body);
        const ddcl = await repo.createDdcl(input);
        return reply.code(201).send({ ...ddcl, tabLabel: tabLabel(ddcl.releaseHeader?.date, ddcl.title) });
      });

      api.post<{ Params: { id: string } }>('/ddcls/:id/checklist-items', async (request, reply) => {
        const input = validateChecklistInput(request.body);
        return reply.code(201).send(await repo.addChecklistItem(request.params.id, input));
      });

      api.get<{ Params: { id: string } }>('/ddcls/:id/export', async (request, reply) => {
        const ddcl = await repo.getDdclForExport(request.params.id);
        if (!ddcl) throw new NotFoundError(`DDCL tidak ditemukan: ${request.params.id}`);
        const file = await exportDdclToXlsx(config.templatePath, ddcl);
        return reply
          .header('Content-Type', XLSX_MIME)
          .header('Content-Disposition', `attachment; filename="DDCL-${ddcl.id}.xlsx"`)
          .send(file);
      });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
