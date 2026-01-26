import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages - set base to repo name if not using custom domain
  // Change to '/' if using a custom domain like retireonsol.com
  base: '/RetireOnSol/',
})
