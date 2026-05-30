import { defineConfig } from 'vite';

export default defineConfig({
  // Base path config for GitHub Pages: /repository-name/
  base: '/game-batting/',
  server: {
    // Expose network address so user can test on local Wi-Fi with iPhone/iPad
    host: true, 
    port: 5173
  }
});
