import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Optional: for allowing access from the network
    port: 3000,
    open: false, // Optional: open the browser automatically
  }
})