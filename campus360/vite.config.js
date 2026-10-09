import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// In development, /api calls are passed to the backend, so the browser has no cross-origin problems.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:4000' } } })
