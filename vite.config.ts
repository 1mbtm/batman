import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function adminRoutePlugin() {
  return {
    name: 'admin-route-plugin',
    closeBundle() {
      const distAdmin = path.resolve(__dirname, 'dist/admin')
      fs.mkdirSync(distAdmin, { recursive: true })
      fs.copyFileSync(
        path.resolve(__dirname, 'dist/index.html'),
        path.resolve(distAdmin, 'index.html')
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminRoutePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) {
            return 'framer-motion';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-icons';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5174,
    watch: {
      ignored: ['**/emojis/**', '**/*.png', '**/*.mp3', '**/1.txt', '**/2.txt'],
    },
  },
})
