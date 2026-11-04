import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: { target: mode === 'demo' ? 'es2022' : ['es2020', 'safari14'] },
  server: { host: "0.0.0.0", port: 5173, proxy: {'/api':'http://127.0.0.1:3001'} },
}));
