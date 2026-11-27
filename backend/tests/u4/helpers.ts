import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp, BuildAppOptions } from '../../src/app';
import type { Role, Status } from '../../src/accountRules';
import type { AppConfig } from '../../src/config';
import { createHashGate } from '../../src/hashGate';
import { createPasswordService } from '../../src/passwordService';
import { createRepository, Repository } from '../../src/repository';
import { issueSession } from '../../src/sessionRepository';

export const ORIGIN = 'http://localhost:5173';
export const TEST_PASSWORD = 'correct-horse-battery';

/** Real scrypt, cheap parameters: tests that log in for real stay fast. The default parameters have their own test. */
export const cheapPasswords = createPasswordService(createHashGate(), { N: 1024, r: 8, p: 1 });

let counter = 0;
let cachedHash: Promise<string> | undefined;
const testHash = () => (cachedHash ??= cheapPasswords.hash(TEST_PASSWORD));

export interface MakeUserOptions {
  role?: Role;
  status?: Status;
  email?: string;
  name?: string;
  /** When set, the password is hashed for real so the user can log in with it. */
  password?: string;
}

/** Creates a user. Without `password`, a precomputed hash of TEST_PASSWORD is stored. */
export async function makeUser(prisma: PrismaClient, opts: MakeUserOptions = {}) {
  counter++;
  const passwordHash = opts.password ? await cheapPasswords.hash(opts.password) : await testHash();
  return prisma.user.create({
    data: {
      name: opts.name ?? `User ${counter}`,
      email: opts.email ?? `user${counter}@example.test`,
      passwordHash,
      role: opts.role ?? 'editor',
      status: opts.status ?? 'active',
    },
  });
}

/** A session for the user; returns the Bearer token. */
export async function makeSession(prisma: PrismaClient, userId: string): Promise<string> {
  return (await issueSession(prisma, userId)).token;
}

export function testConfig(over: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    allowedOrigins: [ORIGIN],
    templatePath: '/nonexistent.xlsx',
    cookieSecure: false,
    trustProxy: false,
    admin: null,
    ...over,
  };
}

export type AuthApp = FastifyInstance & {
  /** `Authorization` header for a user of that role. */
  as(role: Role): { authorization: string };
  users: Record<Role, { id: string; email: string }>;
  /** Fastify's own inject, without the default admin header. */
  rawInject: FastifyInstance['inject'];
};

/**
 * An app over the test database with one active user and session per role. `app.inject` adds the admin's
 * Bearer header unless the request brings its own `authorization` or a `cookie`; use `as(role)` to pick a
 * role and `rawInject` to send a request without any credentials.
 */
export async function authApp(
  prisma: PrismaClient,
  extra: Partial<BuildAppOptions> = {},
  repo: Repository = createRepository(prisma, { passwords: cheapPasswords }),
  config: AppConfig = testConfig(),
): Promise<AuthApp> {
  const app = (await buildApp({ repo, config, logger: false, ...extra })) as AuthApp;
  const headers = {} as Record<Role, { authorization: string }>;
  app.users = {} as AuthApp['users'];
  for (const role of ['viewer', 'editor', 'admin'] as const) {
    const email = `${role}@example.test`;
    // A second app over the same database (some tests build one) reuses the accounts.
    const u =
      (await prisma.user.findUnique({ where: { email } })) ?? (await makeUser(prisma, { role, email, name: role }));
    headers[role] = { authorization: `Bearer ${await makeSession(prisma, u.id)}` };
    app.users[role] = { id: u.id, email: u.email };
  }
  app.as = (role) => headers[role];
  const raw = app.inject.bind(app) as (o: InjectOptions) => unknown;
  app.rawInject = raw as AuthApp['rawInject'];
  (app as { inject: unknown }).inject = (opts: InjectOptions | string, cb?: unknown) => {
    const o: InjectOptions = typeof opts === 'string' ? { url: opts } : opts;
    const h = (o.headers ?? {}) as Record<string, unknown>;
    const withAuth = 'authorization' in h || 'cookie' in h ? o : { ...o, headers: { ...h, ...headers.admin } };
    return (raw as (o: InjectOptions, c?: unknown) => unknown)(withAuth, cb);
  };
  return app;
}
