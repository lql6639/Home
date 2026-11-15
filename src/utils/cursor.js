let mainCursor

const lerp = (a, b, n) => {
  if (Math.round(a) === b) {
    return b
  }
  return (1 - n) * a + n * b
}

const cursorInit = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return null
  mainCursor = new Cursor()
  return mainCursor
}

class Cursor {
  constructor() {
    this.pos = {
      curr: null,
      prev: null
    }
    this.create()
    this.init()
  }

  move(left, top) {
    if (!this.cursor) return
    this.cursor.style['left'] = `${left}px`
    this.cursor.style['top'] = `${top}px`
  }

  create() {
    if (typeof document === 'undefined') return
    if (!this.cursor) {
      this.cursor = document.createElement('div')
      this.cursor.id = 'cursor'
      this.cursor.classList.add('xs-hidden')
      this.cursor.classList.add('hidden')
      document.body.append(this.cursor)
    }

    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    if (isMobile) {
      this.cursor.classList.add('hidden')
      document.body.style.cursor = 'auto'
      return
    }

    // 不再全量遍历 DOM + getComputedStyle（会触发强制重排，是页面卡顿主因）。
    // 是否显示 pointer 光标改为 mousemove 时用事件委托按需判断（见 init）。
    if (!this.scr) {
      this.scr = document.createElement('style')
      document.body.appendChild(this.scr)
      this.scr.innerHTML = `* {cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' width='10px' height='10px'><circle cx='4' cy='4' r='4' fill='white' /></svg>") 4 4, auto !important}`
    }
  }

  refresh() {
    this.scr?.remove()
    this.scr = null
    this.cursor?.classList.remove('active')
    this.pos = {
      curr: null,
      prev: null
    }
    this.create()
    this.init()
  }

  init() {
    if (typeof document === 'undefined') return
    const isMobile = /Mobi|Android/i.test(navigator.userAgent)
    if (isMobile) return

    document.onmousemove = (e) => {
      if (this.pos.curr == null) this.move(e.clientX - 8, e.clientY - 8)
      this.pos.curr = {
        x: e.clientX - 8,
        y: e.clientY - 8
      }
      // 事件委托：仅判断当前 hover 元素是否 pointer 光标（零全量遍历/重排）
      this.toggleCursorForTarget(e.target)
      this.cursor.classList.remove('hidden')
      this.render()
    }
    document.onmouseenter = () => this.cursor.classList.remove('hidden')
    document.onmouseleave = () => this.cursor.classList.add('hidden')
    document.onmousedown = () => this.cursor.classList.add('active')
    document.onmouseup = () => this.cursor.classList.remove('active')
  }

  // 按需判断 hover 元素是否可点击：是则隐藏自定义光标、还原系统 pointer；
  // 否则显示自定义光标。仅对单个元素取 getComputedStyle，开销可忽略。
  toggleCursorForTarget(target) {
    if (!this.cursor || !(target instanceof Element)) return
    let cursorStyle = 'default'
    try {
      cursorStyle = window.getComputedStyle(target).cursor
    } catch {
      /* 忽略 */
    }
    this.cursor.style.display = cursorStyle === 'pointer' ? 'none' : 'block'
  }

  render() {
    if (typeof document === 'undefined') return
    if (!this.pos.curr) return

    if (this.pos.prev) {
      this.pos.prev.x = lerp(this.pos.prev.x, this.pos.curr.x, 0.35)
      this.pos.prev.y = lerp(this.pos.prev.y, this.pos.curr.y, 0.35)
      this.move(this.pos.prev.x, this.pos.prev.y)
    } else {
      this.pos.prev = this.pos.curr
    }
    // 用坐标差值判断是否还需继续插值：鼠标停下后就停止 rAF，不再无限空转
    const dx = this.pos.curr.x - this.pos.prev.x
    const dy = this.pos.curr.y - this.pos.prev.y
    if (dx * dx + dy * dy > 0.05) {
      requestAnimationFrame(() => this.render())
    }
  }
}

export default cursorInit
