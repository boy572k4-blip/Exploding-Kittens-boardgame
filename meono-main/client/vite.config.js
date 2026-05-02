// noinspection JSValidateTypes,JSUnusedGlobalSymbols

import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    envDir: './',
    css: {
        postcss: {
            plugins: [tailwindcss()],
        },
    },
    publicDir: "static",
});
