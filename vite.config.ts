import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the project from https://<user>.github.io/qr-maze/,
  // so every asset URL has to carry the repository name. `vite dev` and
  // `vite preview` honour the same base, so what runs locally is what ships.
  base: '/qr-maze/',
  plugins: [react()],
})
