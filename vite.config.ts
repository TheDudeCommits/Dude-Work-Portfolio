import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') < 0) return undefined
          if (id.indexOf('/three/examples/') >= 0) return 'three-addons'
          if (id.indexOf('/three/') >= 0) return 'three-runtime'
          if (id.indexOf('@react-three/drei') >= 0) return 'r3f-drei'
          if (id.indexOf('@react-three/fiber') >= 0 || id.indexOf('react-reconciler') >= 0) return 'r3f-core'
          if (id.indexOf('postprocessing') >= 0) return 'ink-effects'
          if (id.indexOf('lucide-react') >= 0) return 'symbols'
          if (id.indexOf('/react/') >= 0 || id.indexOf('/react-dom/') >= 0 || id.indexOf('/scheduler/') >= 0) return 'react-runtime'
          return 'vendor'
        },
      },
    },
  },
  plugins: [react()],
})
