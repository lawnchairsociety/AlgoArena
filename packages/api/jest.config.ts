import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '(?<!\\.e2e)\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@algoarena/shared$': '<rootDir>/../../packages/shared/src',
  },
  testTimeout: 5000,
};

export default config;
