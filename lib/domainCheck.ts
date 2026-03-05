export function domainAllowed(host: string, allowedDomains: string[]): boolean {
  const normalized = host.toLowerCase();
  return allowedDomains.some((entry) => {
    const rule = entry.toLowerCase().trim();
    if (!rule) return false;
    if (rule === '*') return true;
    if (rule.startsWith('*.')) return normalized.endsWith(rule.slice(1));
    return normalized === rule;
  });
}
