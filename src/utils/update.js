import { ref } from 'vue'

// 当前构建版本号（由 vite.config.js 通过 define 注入）
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
// 每 5 分钟检查一次
const CHECK_INTERVAL = 5 * 60 * 1000

// 是否有新版本
export const hasUpdate = ref(false)

// 用户点了「稍后」的版本号，同一版本不再重复提示
let ignoredVersion = null
// 检测到的最新版本号
let latestVersion = null

// 拉取线上 version.json
async function fetchRemoteVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.version || null
  } catch {
    return null
  }
}

// 检查是否发布新版本
export async function checkUpdate() {
  const remote = await fetchRemoteVersion()
  if (!remote || remote === CURRENT_VERSION) return false
  latestVersion = remote
  if (remote === ignoredVersion) return false
  hasUpdate.value = true
  return true
}

// 本次忽略更新
export function ignoreUpdate() {
  ignoredVersion = latestVersion
  hasUpdate.value = false
}

// 立即更新：清空 PWA 缓存与 localStorage 后强制刷新
export async function applyUpdate() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    }
  } catch (e) {
    console.warn('[update] 清理缓存失败：', e)
  }

  // 清空 localStorage（含 pinia 持久化数据），避免旧设置覆盖新版本默认值
  localStorage.clear()

  // 带时间戳刷新，绕过浏览器与 CDN 缓存
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now())
  window.location.replace(url.toString())
}

// 启动检测：首次 + 定时 + 页面重新可见时
export function startUpdateWatcher() {
  checkUpdate()
  setInterval(checkUpdate, CHECK_INTERVAL)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkUpdate()
  })
}
