import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";


export default defineConfig({
    plugins: [react(), tailwindcss(),wasm()],
    optimizeDeps: {
        exclude: ['argon2-browser']
    },
    server: {
        proxy: {
            "/api": {
                target: "https://localhost",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});