/**
 * Recovery script (NFR3.22): the last way back in when no admin can sign in. Run inside the backend image:
 *   docker compose run --rm backend node dist/scripts/recovery.js reset-password <email>
 * The password comes only from a hidden prompt or from stdin (--password-stdin), never from arguments.
 */
import { PrismaClient } from '@prisma/client';
import { validateEmail } from '../accountRules';
import { writeAudit } from '../auditRepository';
import { createHashGate } from '../hashGate';
import { checkPasswordLength, createPasswordService, PasswordService } from '../passwordService';
import { revokeAllForUser } from '../sessionRepository';
import { clearThrottle } from '../throttleService';

export const COMMANDS = ['reset-password', 'unlock', 'reactivate', 'make-admin'] as const;
export type RecoveryCommand = (typeof COMMANDS)[number];

export interface RecoveryArgs {
  command: RecoveryCommand;
  email: string;
  passwordStdin: boolean;
}

export const USAGE =
  'Pemakaian: recovery.js <reset-password|unlock|reactivate|make-admin> <email> [--password-stdin]';

/** Refuses any way of putting a password on the command line (it would land in shell history and `ps`). */
export function parseArgs(argv: string[]): RecoveryArgs {
  const banned = argv.find((a) => /^(--password(=|$)|-e$|--env)/.test(a) || /^-e./.test(a));
  if (banned !== undefined) {
    throw new Error('Kata sandi tidak boleh diberikan lewat argumen. Gunakan prompt tersembunyi atau --password-stdin.');
  }
  const flags = argv.filter((a) => a.startsWith('-'));
  const rest = argv.filter((a) => !a.startsWith('-'));
  const unknown = flags.filter((f) => f !== '--password-stdin');
  const [command, email, ...extra] = rest;
  if (unknown.length > 0 || !command || !email || extra.length > 0 || !(COMMANDS as readonly string[]).includes(command)) {
    throw new Error(USAGE);
  }
  return { command: command as RecoveryCommand, email, passwordStdin: flags.includes('--password-stdin') };
}

/** Core logic, free of any terminal I/O so it can be tested. Every change and its audit row share one transaction. */
export async function runRecovery(
  prisma: PrismaClient,
  passwords: PasswordService,
  command: RecoveryCommand,
  emailRaw: string,
  password?: string,
): Promise<string> {
  const email = validateEmail(emailRaw);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Akun tidak ditemukan: ${email}`);

  switch (command) {
    case 'reset-password': {
      const checked = checkPasswordLength(password);
      const passwordHash = await passwords.hash(checked);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
        await revokeAllForUser(tx, user.id);
        await clearThrottle(tx, email);
        await writeAudit(tx, { type: 'password_reset_by_admin', targetUserId: user.id, email, detail: 'recovery-script' });
      });
      return `Kata sandi ${email} diatur ulang; semua sesinya dicabut dan kunci login dibuka.`;
    }
    case 'unlock':
      await prisma.$transaction(async (tx) => {
        await clearThrottle(tx, email);
        await writeAudit(tx, { type: 'lockout_cleared_by_admin', targetUserId: user.id, email, detail: 'recovery-script' });
      });
      return `Kunci login ${email} dibuka.`;
    case 'reactivate':
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { status: 'active' } });
        await writeAudit(tx, { type: 'account_reactivated', targetUserId: user.id, email, detail: 'recovery-script' });
      });
      return `Akun ${email} diaktifkan kembali.`;
    case 'make-admin':
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { role: 'admin' } });
        await writeAudit(tx, {
          type: 'role_changed',
          targetUserId: user.id,
          email,
          detail: `recovery-script: ${user.role} -> admin`,
        });
      });
      return `Akun ${email} kini admin.`;
  }
}

/* v8 ignore start -- terminal I/O: checked by hand (unit-test-instructions, "Pemeriksaan manual") */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Tidak ada terminal interaktif. Pakai --password-stdin dan jalankan compose dengan -T.'));
      return;
    }
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n' || c === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u0003') {
          process.stdin.setRawMode(false);
          reject(new Error('Dibatalkan.'));
          return;
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let password: string | undefined;
  if (args.command === 'reset-password') {
    password = args.passwordStdin ? await readStdin() : await promptHidden('Kata sandi baru (10-128 karakter): ');
  }
  const prisma = new PrismaClient();
  try {
    const message = await runRecovery(prisma, createPasswordService(createHashGate()), args.command, args.email, password);
    console.log(JSON.stringify({ level: 'info', event: 'recovery_script', command: args.command, email: args.email }));
    console.log(message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
/* v8 ignore stop */
