import { describe, expect, it } from 'vitest';
import { HSTS, SECURITY_HEADERS, contentSecurityPolicy, withNonce } from '~/utils/security';

describe('security headers', () => {
  it('builds a CSP without unsafe inline scripts that trusts the API origin', () => {
    const csp = contentSecurityPolicy('abc123', 'https://api.refrigeracaocastro.com.br/ignored/path');
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("connect-src 'self' https://api.refrigeracaocastro.com.br;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp.split('script-src')[1]!.split(';')[0]).not.toContain('unsafe-inline');
  });

  it('adds the nonce to script tags that do not have one', () => {
    const html =
      '<script>boot()</script><script type="module" src="/a.js"></script><script nonce="x">y</script>';
    expect(withNonce(html, 'n1')).toBe(
      '<script nonce="n1">boot()</script><script nonce="n1" type="module" src="/a.js"></script><script nonce="x">y</script>',
    );
    expect(withNonce('<noscript>sem js</noscript>', 'n1')).toBe('<noscript>sem js</noscript>');
  });

  it('declares the static headers', () => {
    expect(SECURITY_HEADERS['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(SECURITY_HEADERS['permissions-policy']).toContain('camera=()');
    expect(HSTS).toContain('max-age=');
  });
});
