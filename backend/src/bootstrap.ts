import type { PrismaClient } from '@prisma/client';
import { normalizeEmail, validateEmail } from './accountRules';
import type { AppConfig } from './config';
import { ValidationError } from './errors';
import { checkPasswordLength, PasswordService } from './passwordService';

/** Same key for bootstrap and backfill: only one instance works on them at a time (reliability-design). */
const ADVISORY_KEY = 4_242_001;
export const PLACEHOLDER_PASSWORD = 'change-me-at-least-10-chars';

export type BootLog = { info: (obj: object, msg: string) => void };

/** BR4.11: first admin from ADMIN_* when no user exists. Errors name the variable, never the value. */
export async function bootstrapAdmin(
  prisma: PrismaClient,
  config: Pick<AppConfig, 'admin'>,
  passwords: PasswordService,
  log: BootLog,
): Promise<{ created: boolean }> {
  if ((await prisma.user.count()) > 0) return { created: false };

  const admin = config.admin;
  if (!admin || admin.email === '' || admin.password === '') {
    throw new Error(
      'Belum ada akun. Isi ADMIN_EMAIL dan ADMIN_PASSWORD di lingkungan backend untuk membuat admin pertama.',
    );
  }
  let email: string;
  try {
    email = validateEmail(admin.email, 'ADMIN_EMAIL');
  } catch {
    throw new Error('ADMIN_EMAIL tidak valid: harus berupa alamat email.');
  }
  if (admin.password === PLACEHOLDER_PASSWORD) {
    throw new Error('ADMIN_PASSWORD masih berisi nilai contoh dari .env.example: ganti dengan kata sandi sendiri.');
  }
  try {
    checkPasswordLength(admin.password, 'ADMIN_PASSWORD');
  } catch (err) {
    if (err instanceof ValidationError) throw new Error('ADMIN_PASSWORD tidak valid: harus 10 sampai 128 karakter.');
    throw err;
  }
  const name = admin.name !== '' ? admin.name.slice(0, 100) : (email.split('@')[0] ?? email);
  const passwordHash = await passwords.hash(admin.password);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_KEY}::bigint)`;
    if ((await tx.user.count()) > 0) return false; // another instance won the race
    await tx.user.create({ data: { name, email: normalizeEmail(email), passwordHash, role: 'admin', status: 'active' } });
    return true;
  });
  if (created) log.info({ event: 'admin_bootstrapped', email }, 'First admin account created');
  return { created };
}

/** BR4.16: fills createdByUserId of old DDCLs with the earliest admin, then verifies none is left empty. */
export async function backfillCreatedBy(prisma: PrismaClient): Promise<{ filled: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_KEY}::bigint)`;
    const empty = await tx.ddclDocument.count({ where: { createdByUserId: null } });
    if (empty === 0) return { filled: 0 };
    const first = await tx.user.findFirst({
      where: { role: 'admin' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (!first) throw new Error('Ada DDCL tanpa pembuat tetapi belum ada akun admin untuk mengisinya.');
    const { count } = await tx.ddclDocument.updateMany({
      where: { createdByUserId: null },
      data: { createdByUserId: first.id },
    });
    if ((await tx.ddclDocument.count({ where: { createdByUserId: null } })) > 0) {
      throw new Error('Pengisian createdByUserId tidak lengkap; start dibatalkan.');
    }
    return { filled: count };
  });
}
