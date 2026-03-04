export type StoreMode = 'json' | 'supabase' | 'postgres';

export function normalizeStoreMode(rawStoreType: string | undefined): StoreMode | 'unsupported' {
  const normalized = (rawStoreType || 'json')
    .trim()
    .toLowerCase()
    .replace(/^['"]|['"]$/g, '');

  if (normalized === 'json' || normalized === 'supabase' || normalized === 'postgres') {
    return normalized;
  }
  return 'unsupported';
}
