/** Fixed category list (BR2.12). Categories are labels only; they carry no per-category fields. */
export const CATEGORIES = ['Database', 'Bastion', 'RabbitMQ', 'Keycloak'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'error'; index: number };

const VARIABLE_AT = /^\{([A-Za-z0-9_-]+)\}/;

/**
 * BR2.4: one-token-at-a-time scanner. `{{` and `}}` are literal braces, `{name}` is a variable
 * (case-sensitive, ^[A-Za-z0-9_-]+$), every other brace is an error token carrying its UTF-16 index.
 * `{{{x}}}` therefore reads as literal `{`, variable x, literal `}`.
 */
export function scanText(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) tokens.push({ type: 'text', value: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '{' && text[i + 1] === '{') {
      buffer += '{';
      i += 2;
    } else if (ch === '}' && text[i + 1] === '}') {
      buffer += '}';
      i += 2;
    } else if (ch === '{') {
      const match = VARIABLE_AT.exec(text.slice(i));
      if (match?.[1]) {
        flush();
        tokens.push({ type: 'variable', name: match[1] });
        i += match[0].length;
      } else {
        flush();
        tokens.push({ type: 'error', index: i });
        i += 1;
      }
    } else if (ch === '}') {
      flush();
      tokens.push({ type: 'error', index: i });
      i += 1;
    } else {
      buffer += ch;
      i += 1;
    }
  }
  flush();
  return tokens;
}

/** Index of the first invalid brace (as a 1-based code-point position), or null when the text is valid. */
export function firstTextError(text: string): number | null {
  const bad = scanText(text).find((t) => t.type === 'error');
  if (!bad || bad.type !== 'error') return null;
  return Array.from(text.slice(0, bad.index)).length + 1;
}

/** Unique variable names across all texts, in order of first appearance. */
export function extractVariables(texts: string[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) {
    for (const token of scanText(text)) {
      if (token.type === 'variable') seen.add(token.name);
    }
  }
  return [...seen];
}

/**
 * The single render function shared by the screen, the snapshot readers (U3) and the export (U6):
 * `{{`/`}}` become literal braces and `{name}` is replaced by its value; a variable without a value
 * stays visible as `{name}`. Stored text is validated, so error tokens are written back literally.
 */
export function renderText(text: string, values: Record<string, string> = {}): string {
  let out = '';
  for (const token of scanText(text)) {
    if (token.type === 'text') {
      out += token.value;
    } else if (token.type === 'variable') {
      out += Object.prototype.hasOwnProperty.call(values, token.name)
        ? (values[token.name] as string)
        : `{${token.name}}`;
    } else {
      out += text[token.index] ?? '';
    }
  }
  return out;
}

/** Escapes LIKE wildcards so a user's `%`, `_` or `\` match only themselves (NFR2.9). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
