import type { Role } from '@rc/contracts';

/** First page of each role after signing in (UC Autenticar, step 4). */
export function landingFor(role: Role): string {
  if (role === 'CLIENT') return '/';
  if (role === 'EMPLOYEE') return '/hoje';
  return '/painel';
}

/** Where "Minha conta" leads from the public site: the profile for customers, the work area for the team. */
export function accountHomeFor(role: Role): string {
  return role === 'CLIENT' ? '/perfil' : landingFor(role);
}

/** Accepts only paths inside the site, so ?redirect= cannot send anyone to another domain. */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value.startsWith('/entrar')) return null;
  return value;
}

/** First name for greetings: "Marina Gerente" becomes "Marina". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0]!;
}
