import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function resolveManualChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/');
  if (!normalizedId.includes('/node_modules/')) return undefined;
  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (normalizedId.includes('/node_modules/pdfjs-dist/')) {
    return 'vendor-pdf';
  }
  if (
    normalizedId.includes('/node_modules/tesseract.js/') ||
    normalizedId.includes('/node_modules/tesseract.js-core/')
  ) {
    return 'vendor-ocr';
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    worker: {
      format: 'es',
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk,
        },
      },
    },
    build: {
      sourcemap: mode === 'production' ? false : false,
      rollupOptions: {
        output: {
          manualChunks: resolveManualChunk,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
