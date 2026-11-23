export interface AppConfig {
  port: number;
  frontendOrigin: string;
  templatePath: string;
}

/** Reads configuration from the environment. Secrets (DATABASE_URL) are read by Prisma directly. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.BACKEND_PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`BACKEND_PORT tidak valid: ${env.BACKEND_PORT}`);
  }
  return {
    port,
    frontendOrigin: env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    templatePath:
      env.DDCL_TEMPLATE_PATH ?? '/app/template/DDCL BCAS PROD 202611 - TEMPLATE.xlsx',
  };
}
