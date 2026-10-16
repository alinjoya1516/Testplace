import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // The generated Prisma client imports its own .ts files with a .js extension.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  globalSetup: './test/global-setup.ts',
  setupFiles: ['./test/setup-env.ts'],
  // Every test file shares the same database.
  maxWorkers: 1,
};

export default config;
