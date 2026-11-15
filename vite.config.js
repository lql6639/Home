/* eslint-disable no-undef */
import { defineConfig, loadEnv } from 'vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import viteCompression from 'vite-plugin-compression'
import { analyzer } from 'vite-bundle-analyzer'

// 构建版本号：每次构建都不同，用于前端检测新版本
const buildVersion = Date.now().toString(36)

// 构建后输出 version.json，供前端轮询比对
const versionFile = () => ({
  name: 'emit-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: buildVersion, buildTime: new Date().toISOString() })
    })
  }
})

// https://vitejs.dev/config/
export default ({ mode }) =>
  defineConfig({
    base: './',
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue'],
        resolvers: [ElementPlusResolver()]
      }),
      Components({
        resolvers: [ElementPlusResolver()]
      }),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          // 页面导航走网络优先：部署新版本后旧 HTML 不会一直被缓存命中
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              // HTML 文档：网络优先，拿不到新内容才回退缓存
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'page-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            },
            {
              // js/css 带内容 hash，可长缓存；加过期时间防止无限膨胀
              urlPattern: /(.*?)\.(js|css|woff2|woff|ttf)/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'js-css-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        },
        manifest: {
          name: loadEnv(mode, process.cwd()).VITE_SITE_NAME,
          short_name: loadEnv(mode, process.cwd()).VITE_SITE_NAME,
          description: loadEnv(mode, process.cwd()).VITE_SITE_DES,
          display: 'standalone',
          start_url: '/',
          theme_color: '#424242',
          background_color: '#424242',
          icons: [
            {
              src: '/home-image/icon/48.png',
              sizes: '48x48',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/72.png',
              sizes: '72x72',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/96.png',
              sizes: '96x96',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/144.png',
              sizes: '144x144',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/home-image/icon/512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      }),
      viteCompression(),
      // 仅在 `vite build --mode analyze` 时启用，避免日常构建被交互式分析器阻塞
      ...(mode === 'analyze' ? [analyzer()] : []),
      versionFile()
    ],
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion)
    },
    server: {
      port: '3000',
      open: true
    },
    resolve: {
      alias: [
        {
          find: '@',
          replacement: resolve(__dirname, 'src')
        }
      ]
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern',
          additionalData: `@use "./src/style/global.scss" as *;`,
          silenceDeprecations: ['legacy-js-api']
        }
      }
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          pure_funcs: ['console.log']
        }
      }
    }
  })
