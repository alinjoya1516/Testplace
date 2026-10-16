import { loadAppConfig } from './app-config';

describe('loadAppConfig', () => {
  it('applies defaults', () => {
    expect(loadAppConfig({})).toMatchObject({
      authMode: 'none',
      importLimits: { maxArchiveBytes: 5 * 1024 * 1024, maxFiles: 1000 },
    });
  });

  it('reads limits from the environment', () => {
    expect(loadAppConfig({ IMPORT_MAX_FILES: '10' }).importLimits.maxFiles).toBe(10);
  });

  it('refuses the dev user in production', () => {
    expect(() => loadAppConfig({ AUTH_MODE: 'dev', NODE_ENV: 'production' })).toThrow(/forbidden/);
  });

  it('accepts the dev user in development', () => {
    expect(loadAppConfig({ AUTH_MODE: 'dev' }).authMode).toBe('dev');
  });
});
