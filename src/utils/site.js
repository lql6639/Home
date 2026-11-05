// 站点域名统一从这里取：只改 .env 里的 VITE_SITE_URL 就行，组件不再手写
const FALLBACK = import.meta.env.VITE_SITE_ANTHOR

const rawUrl = () => String(import.meta.env.VITE_SITE_URL || '').trim()

// 取值顺序：VITE_SITE_URL → 当前访问域名 → 兜底常量
// 忘了配 .env 时显示真实访问的域名，而不是某个写死的旧域名
const resolveUrl = () => {
  const url = rawUrl()
  if (url) return url
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname
  }
  return FALLBACK
}

// 纯域名：去掉协议、端口、路径与末尾斜杠
export const siteHost = resolveUrl()
  .replace(/^(https?:)?\/\//i, '')
  .split('/')[0]
  .split(':')[0]

// 按点拆段，并带上该位置对应的样式类：
// 第 1 段 bg（大）、第 2 段 sm（中）、第 3 段起 smm（小）——各组件 scoped 样式里就是这三个类
// lovlin.eu → 2 段；lovlin.eu.cc → 3 段
export const siteParts = siteHost
  .split('.')
  .filter(Boolean)
  .map((part, i) => ({
    text: i === 0 ? part : `.${part}`,
    cls: i === 0 ? 'bg' : i === 1 ? 'sm' : 'smm'
  }))

// 页脚用的完整地址：没写协议就补 //，保持和原来一致的规则
export const siteHref = (() => {
  const url = rawUrl()
  if (!url) return `//${siteHost}`
  return /^(https?:)?\/\//i.test(url) ? url : `//${url}`
})()
