import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ValidationError } from './errors';
import type { HashGate } from './hashGate';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** NFR2.20: N=32768 (32 MiB working memory), r=8, p=1. Parameters are stored in each hash. */
export const DEFAULT_SCRYPT: ScryptParams = { N: 32768, r: 8, p: 1 };
const MAXMEM = 64 * 1024 * 1024;
const KEYLEN = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEYLEN,
      { N: params.N, r: params.r, p: params.p, maxmem: MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** BR4.2: 10-128 characters, counted before any hash is computed (rejects huge inputs before they cost CPU). */
export function checkPasswordLength(password: unknown, field = 'password'): string {
  if (typeof password !== 'string') {
    throw new ValidationError(`Field wajib belum diisi: ${field}`, [field]);
  }
  const length = [...password].length;
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    throw new ValidationError(
      `Kata sandi harus ${PASSWORD_MIN} sampai ${PASSWORD_MAX} karakter`,
      [field],
    );
  }
  return password;
}

export interface PasswordService {
  hash(password: string): Promise<string>;
  /** Constant-time comparison; parameters come from the stored value, so old hashes stay readable. */
  verify(password: string, stored: string): Promise<boolean>;
  /** Same cost as `verify` for an unknown email; always false (BR4.2). */
  verifyDummy(password: string): Promise<boolean>;
}

function parse(stored: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  return {
    params: { N, r, p },
    salt: Buffer.from(parts[4] ?? '', 'base64'),
    hash: Buffer.from(parts[5] ?? '', 'base64'),
  };
}

/** Every hash computation goes through the gate, so at most 2 run at once (NFR1.24). */
export function createPasswordService(
  gate: HashGate,
  params: ScryptParams = DEFAULT_SCRYPT,
): PasswordService {
  // A fixed dummy hash: unknown emails still pay for one scrypt run with the current parameters.
  const dummySalt = randomBytes(SALT_BYTES);
  return {
    hash(password) {
      return gate.run(async () => {
        const salt = randomBytes(SALT_BYTES);
        const key = await derive(password, salt, params);
        return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${key.toString('base64')}`;
      });
    },
    verify(password, stored) {
      const parsed = parse(stored);
      if (!parsed) return Promise.resolve(false);
      return gate.run(async () => {
        const key = await derive(password, parsed.salt, parsed.params);
        return key.length === parsed.hash.length && timingSafeEqual(key, parsed.hash);
      });
    },
    verifyDummy(password) {
      return gate.run(async () => {
        await derive(password, dummySalt, params);
        return false;
      });
    },
  };
}
