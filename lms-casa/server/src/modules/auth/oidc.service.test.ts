import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    OIDC_ISSUER: '',
    OIDC_CLIENT_ID: '',
    OIDC_CLIENT_SECRET: '',
    OIDC_REDIRECT_URI: 'http://localhost/cb',
    OIDC_AUTO_PROVISION: false,
  },
}));

import { isOidcConfigured } from './oidc.service.js';

describe('oidc.service', () => {
  it('isOidcConfigured returns false when env unset', () => {
    expect(isOidcConfigured()).toBe(false);
  });
});
