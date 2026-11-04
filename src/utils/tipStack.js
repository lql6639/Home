import { nextTick, onBeforeUnmount, watch } from 'vue'

// 底部提示条的堆叠：先出现的那一条贴底，后来的依次往上叠，谁消失下面的自动落回来
const GAP = 10 // 两条之间的间距
const order = [] // 数组顺序 = 从屏幕底部往上
const els = new Map() // id -> 元素

// 与 CSS 里的初始 bottom 保持一致，避免首帧跳动
const baseBottom = () => (window.innerWidth <= 768 ? 16 : 24)

const layout = () => {
  let bottom = baseBottom()
  order.forEach((id) => {
    const el = els.get(id)
    if (!el) return
    el.style.bottom = `${bottom}px`
    // 首次落位直接吸到位，之后再有增删才走过渡，避免新条从底下一路飘上来
    if (!el.classList.contains('tip-stacked')) {
      requestAnimationFrame(() => el.classList.add('tip-stacked'))
    }
    // 用真实高度算，手机上一行文字放不下时会换行，高度并不固定
    bottom += el.offsetHeight + GAP
  })
}

const onResize = () => layout()
let listening = false
const listenResize = () => {
  if (listening) return
  listening = true
  window.addEventListener('resize', onResize)
}

const join = async (id, elRef) => {
  listenResize()
  if (!order.includes(id)) order.push(id)
  // 等这一帧的 DOM 落地，否则量不到高度
  await nextTick()
  if (elRef.value) els.set(id, elRef.value)
  layout()
}

const leave = (id) => {
  const i = order.indexOf(id)
  if (i !== -1) order.splice(i, 1)
  els.delete(id)
  layout()
}

/**
 * @param {string} id     唯一标识
 * @param {import('vue').Ref<boolean>} visible  提示条是否显示
 * @param {import('vue').Ref<HTMLElement|null>} elRef  提示条根元素
 */
export const useBottomTipStack = (id, visible, elRef) => {
  watch(
    visible,
    (v) => {
      if (v) join(id, elRef)
      else leave(id)
    },
    { flush: 'post' }
  )

  onBeforeUnmount(() => leave(id))
}
