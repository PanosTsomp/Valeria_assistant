import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    // Dependencies are externalized by default in electron-vite v5
    // node-llama-cpp will NOT be bundled — this is what we want
  },
  preload: {
    // Also externalized by default
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})