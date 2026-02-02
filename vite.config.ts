import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages deployment, use /RetireOnSol/. For Capacitor/Android, use /.
  // Can be overridden via VITE_BASE_PATH env var.
  base: process.env.VITE_BASE_PATH || '/RetireOnSol/',
})
