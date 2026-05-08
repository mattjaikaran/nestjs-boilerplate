// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'package.json',
    config: {
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@auth/(.*)$': '<rootDir>/auth/$1',
        '^@users/(.*)$': '<rootDir>/users/$1',
        '^@todos/(.*)$': '<rootDir>/todos/$1',
        '^@common/(.*)$': '<rootDir>/common/$1',
        '^@config/(.*)$': '<rootDir>/config/$1',
        '^@db/(.*)$': '<rootDir>/database/$1',
      },
    },
  },
  // Scope to pure-logic code. Service files that mock the DB are excluded
  // because SQL-level mutations can only be caught by integration tests, not
  // unit tests against mock chains — they survive trivially and skew the score.
  mutate: [
    'src/common/contracts/**/*.ts',
    '!src/**/*.spec.ts',
  ],
  reporters: ['progress', 'html', 'clear-text'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 80, low: 70, break: 65 },
  coverageAnalysis: 'perTest',
  ignorePatterns: ['dist', 'node_modules', 'generated', 'reports'],
  timeoutMS: 30000,
  concurrency: 4,
};

export default config;
