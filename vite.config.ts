import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  base: '',
  worker: {
    format: 'es',
    rollupOptions: {
      external: ['libheif-js'],
    },
  },
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'codecs/heic/heic-codec': resolve(__dirname, 'src/codecs/heic/heic-codec.ts'),
        'codecs/avif/avif-codec': resolve(__dirname, 'src/codecs/avif/avif-codec.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'libheif-js'],
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
