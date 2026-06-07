import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'middleware/**', 'data/**', 'routes/**'],
    },
    // Integration tests import the app and open SQLite; give them room and avoid
    // cross-file env bleed by isolating each test file.
    isolate: true,
    testTimeout: 20000,
  },
});
