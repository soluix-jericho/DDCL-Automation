/**
 * Variables shown while typing (BR2.4). The server stays the authority: it validates braces and derives
 * the stored variable list. Left-to-right scan: `{{` and `}}` are literal braces, `{name}` is a variable.
 */
export function extractVariables(texts: string[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(/\{\{|\}\}|\{([A-Za-z0-9_-]+)\}/g)) {
      if (m[1]) seen.add(m[1]);
    }
  }
  return [...seen];
}
