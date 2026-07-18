import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/*.test.ts', 'workers/post/test/*.test.ts']
  }
});
