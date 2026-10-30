// Dev server for popup/dashboard pages (extension APIs fall back to in-memory storage in the browser).
// For full extension development, run a browser build and load dist/<browser> unpacked (see docs/INSTALL.md).
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const server = await createServer({ configFile: false, plugins: [react(), tailwindcss()], server: { port: 5173 } });
await server.listen();
server.printUrls();
console.log('Open http://localhost:5173/dashboard.html — note: IndexedDB features work, chrome.* APIs use local fallbacks.');
