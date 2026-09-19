import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The static build is served from its own Nginx location, /campus-store/admin/,
// separate from the API's /campus-store/ proxy block — api.js still points
// at /campus-store for API calls regardless of where these assets live.
// Local dev (`npm run dev`) stays at root.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/campus-store/admin/' : '/',
}));
