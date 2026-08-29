import { describe, expect, it } from 'vitest';
import { parseRuntimeEnvironment } from './index';

describe('parseRuntimeEnvironment', () => {
  it('rejects missing secrets and database configuration', () => {
    expect(() => parseRuntimeEnvironment({})).toThrow();
  });

  it('normalizes ports', () => {
    const config = parseRuntimeEnvironment({
      DATABASE_URL: 'postgresql://localhost/veyra',
      S3_ACCESS_KEY_ID: 'veyra',
      S3_SECRET_ACCESS_KEY: 'development-secret',
      API_PORT: '4400',
    });
    expect(config.API_PORT).toBe(4400);
  });
});
