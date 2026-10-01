import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
    build: {
        rollupOptions: {
            output: {
                // Stable vendor chunks: long-lived in the browser cache, and kept out of the app
                // entry. recharts and tiptap are deliberately NOT grouped here: forcing them into named chunks made
                // the entry import them eagerly. Left to Rollup they stay behind the React.lazy imports and
                // never load on public pages or the auth screens.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    const pkg = id.split('node_modules/').pop()!.split('/');
                    const name = (pkg[0]?.startsWith('@') ? pkg[0] + '/' + (pkg[1] ?? '') : pkg[0]) ?? '';
                    if (['react', 'react-dom', 'scheduler'].includes(name)) return 'vendor-react';
                    if (name.startsWith('@inertiajs/')) return 'vendor-inertia';
                    return undefined;
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
});
