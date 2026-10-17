const supported = /^\/(home|profile|learn|library(?:\/[A-Za-z0-9_-]+)?|practice|words|labs|subjects(?:\/[A-Za-z0-9_-]+(?:\/material)?)?|chapters\/[A-Za-z0-9_-]+|concepts\/[A-Za-z0-9_-]+|intake\/[A-Za-z0-9_-]+|labs\/[A-Za-z0-9_-]+|hardware\/[A-Za-z0-9_-]+|assessments\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)(?:\?.*)?$/;
export function safeReturn(value: string | null | undefined): string {
  if (!value || value.includes('\\') || value.includes('%') || value.startsWith('//') || !supported.test(value)) return '/home';
  return value;
}
const RETURN = 'kiki:return:v1';
export function rememberReturn(value: string) { sessionStorage.setItem(RETURN, safeReturn(value)); }
export function destination() { return safeReturn(sessionStorage.getItem(RETURN)); }
export function clearReturn() { sessionStorage.removeItem(RETURN); }
