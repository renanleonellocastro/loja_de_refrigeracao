import { describe, expect, it } from 'vitest';
import { isCacheablePage, withFreshNonce } from '~/utils/cached-html';

describe('withFreshNonce', () => {
  it('replaces the nonce in every script and style tag and in every directive of the policy', () => {
    const page = {
      html: '<style nonce="old1">p{}</style><script nonce="old1">a</script><script nonce="old1" src="/x.js"></script>',
      policy: "script-src 'self' 'nonce-old1' 'strict-dynamic'; style-src 'self' 'nonce-old1'",
    };
    const fresh = withFreshNonce(page, 'new2');
    expect(fresh.html).toBe(
      '<style nonce="new2">p{}</style><script nonce="new2">a</script><script nonce="new2" src="/x.js"></script>',
    );
    expect(fresh.policy).toBe(
      "script-src 'self' 'nonce-new2' 'strict-dynamic'; style-src 'self' 'nonce-new2'",
    );
  });

  it('returns the page as is when the policy has no nonce', () => {
    const page = { html: '<p>oi</p>', policy: '' };
    expect(withFreshNonce(page, 'new2')).toBe(page);
  });
});

describe('isCacheablePage', () => {
  it('accepts successful pages', () => {
    expect(isCacheablePage({ status: 200, type: 'text/html;charset=utf-8' })).toBe(true);
  });

  it('rejects errors, other content and private pages', () => {
    expect(isCacheablePage({ status: 404, type: 'text/html' })).toBe(false);
    expect(isCacheablePage({ status: 200, type: 'application/json' })).toBe(false);
    expect(isCacheablePage({ status: 200 })).toBe(false);
    expect(isCacheablePage({ status: 200, type: 'text/html', cacheControl: 'no-store' })).toBe(false);
  });
});
