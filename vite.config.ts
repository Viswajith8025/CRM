import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/iclock': {
        target: 'http://192.168.1.34:85',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('zustand')) return 'zustand-vendor';
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            return 'vendor';
          }
        }
      }
    }
  }
})
