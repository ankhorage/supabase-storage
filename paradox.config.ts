import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',

  docs: {
    title: '@ankhorage/supabase-storage',
    description:
      'Type-safe Supabase Storage adapter for uploads, public URLs, and asset metadata.'
  },

  package: {
    root: '.',
    entrypoints: ['src/index.ts'],
  },

  output: {
    dir: './paradox',
  },
});
