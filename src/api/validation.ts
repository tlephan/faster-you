export const VALID_BOARDS = ['today', 'backlog'] as const;
export const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;
export const VALID_LINK_TYPES = ['related', 'blocks', 'blocked_by'] as const;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_TITLE_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_SEARCH_LENGTH = 100;

export function assertUuid(value: unknown, name = 'id'): asserts value is string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

export function assertBoard(value: unknown): asserts value is 'today' | 'backlog' {
  if (!VALID_BOARDS.includes(value as any)) {
    throw new Error(`Invalid board — must be one of: ${VALID_BOARDS.join(', ')}`);
  }
}

export function assertPriority(value: unknown): asserts value is 'high' | 'medium' | 'low' {
  if (!VALID_PRIORITIES.includes(value as any)) {
    throw new Error(`Invalid priority — must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
}

export function assertLinkType(value: unknown): asserts value is 'related' | 'blocks' | 'blocked_by' {
  if (!VALID_LINK_TYPES.includes(value as any)) {
    throw new Error(`Invalid link type — must be one of: ${VALID_LINK_TYPES.join(', ')}`);
  }
}

export function assertText(value: unknown, name: string, maxLen: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
    throw new Error(`${name} must be a non-empty string with at most ${maxLen} characters`);
  }
}
