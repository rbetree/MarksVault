/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/menav/', '/.output/', '/.wxt/'],
  moduleNameMapper: {
    '^wxt/browser$': '<rootDir>/test/mocks/wxt-browser.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
        },
      },
    ],
  },
};
