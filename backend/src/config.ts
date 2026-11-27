export interface AdminBootstrapConfig {
  email: string;
  password: string;
  name: string;
}

export interface AppConfig {
  port: number;
  /** Origins allowed by CORS and by the Origin check on write routes (BR4.15, NFR2.25). */
  allowedOrigins: string[];
  templatePath: string;
  /** Secure attribute of the session cookie (BR4.5). */
  cookieSecure: boolean;
  /** Trust X-Forwarded-For for audit/log addresses (NFR2.32). */
  trustProxy: boolean;
  /** First admin; read only at bootstrap when no user exists, never logged (NFR2.26). */
  admin: AdminBootstrapConfig | null;
}

function flag(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** Reads configuration from the environment. Secrets (DATABASE_URL) are read by Prisma directly. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.BACKEND_PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`BACKEND_PORT tidak valid: ${env.BACKEND_PORT}`);
  }
  const split = (v: string | undefined) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  let allowedOrigins = split(env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) allowedOrigins = split(env.FRONTEND_ORIGIN);
  if (allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS belum diisi: isi daftar origin frontend yang diizinkan (dipisah koma)');
  }
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD;
  const admin: AdminBootstrapConfig | null =
    email || password
      ? { email: email ?? '', password: password ?? '', name: env.ADMIN_NAME?.trim() ?? '' }
      : null;
  return {
    port,
    allowedOrigins,
    templatePath:
      env.DDCL_TEMPLATE_PATH ?? '/app/template/DDCL BCAS PROD 202611 - TEMPLATE.xlsx',
    cookieSecure: flag(env.COOKIE_SECURE),
    trustProxy: flag(env.TRUST_PROXY),
    admin,
  };
}
