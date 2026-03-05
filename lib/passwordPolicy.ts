export function validateOwnerPasswordPolicy(password: string): string | null {
  if (password.length < 10) return 'Password must be at least 10 characters long.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  if (/\s/.test(password)) return 'Password cannot contain spaces.';
  return null;
}
