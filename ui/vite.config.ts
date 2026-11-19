import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

const uiRoot = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.join(uiRoot, '..')
const workspaceRoot = path.join(packageRoot, '..')

function resolveMaplibrePkg(): string {
  const candidates = [
    path.join(workspaceRoot, 'node_modules', '@local-hosting', 'geokit', 'node_modules', 'maplibre-gl'),
    path.join(workspaceRoot, 'node_modules', 'maplibre-gl'),
    path.join(packageRoot, 'node_modules', 'maplibre-gl'),
  ]
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate
    }
  }
  throw new Error('maplibre-gl not found; run yarn install at workspace root')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, packageRoot, '')
  const envWs = loadEnv(mode, workspaceRoot, '')

  const maptilerKey = env.VITE_MAPTILER_KEY || env.MAPTILER_KEY || envWs.MAPTILER_KEY || ''
  const mapboxToken =
    env.VITE_MAPBOX_TOKEN || env.MAPBOX_TOKEN || envWs.MAPBOX_TOKEN || ''
  const protomapsKey =
    env.VITE_PROTOMAPS_KEY || env.PROTOMAPS_KEY || envWs.PROTOMAPS_KEY || ''

  const maplibrePkg = resolveMaplibrePkg()

  return {
    root: uiRoot,
    base: '/ui/',
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.VITE_MAPTILER_KEY': JSON.stringify(maptilerKey),
      'import.meta.env.MAPTILER_KEY': JSON.stringify(maptilerKey),
      'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(mapboxToken),
      'import.meta.env.MAPBOX_TOKEN': JSON.stringify(mapboxToken),
      'import.meta.env.VITE_PROTOMAPS_KEY': JSON.stringify(protomapsKey),
      'import.meta.env.PROTOMAPS_KEY': JSON.stringify(protomapsKey),
    },
    resolve: {
      alias: {
        'maplibre-gl/dist/maplibre-gl.css': path.join(
          maplibrePkg,
          'dist/maplibre-gl.css',
        ),
        'maplibre-gl': path.join(maplibrePkg, 'dist/maplibre-gl-dev.js'),
      },
    },
    optimizeDeps: {
      include: [
        '@local-hosting/geokit/ui/elements-lite',
        '@local-hosting/geokit/ui/elements-lite/register',
      ],
    },
    build: {
      outDir: path.join(uiRoot, 'dist'),
      emptyOutDir: true,
      assetsDir: 'assets',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  }
})