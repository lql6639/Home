import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 花瓣漂浮特效：canvas 动画 + 生命周期监听
 * 组件里只留模板、props 和样式
 *
 * @param {{ density?: number, interactive?: boolean }} props 组件 props（响应式）
 */

export function useFloat(props) {
  const canvasRef = ref(null)

  let ctx = null
  let rafId = 0
  let dpr = 1
  let width = 0
  let height = 0
  let petals = []
  let lastTime = 0
  let resizeTimer = null
  let reducedMotion = false
  let speedScale = 1
  // 全屏特效（如生日蛋糕）展示期间暂停花瓣动画
  let suspended = false
  let img = null

  // 指针位置（-1 ~ 1，用于视差），带缓动
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }

  const rand = (min, max) => min + Math.random() * (max - min)

  // 花瓣数量随视口面积变化：大屏多、手机少，避免手机发烫
  const getCount = () => {
    const areaRatio = (width * height) / (1920 * 1080)
    const count = Math.round(28 * areaRatio * props.density)
    const min = width < 720 ? 9 : 14
    return Math.max(min, Math.min(34, count))
  }

  // 花瓣尺寸随屏幕缩放，保证手机上也看得清、大屏上不夸张
  const getSizeFactor = () =>
    Math.min(1.15, Math.max(0.7, Math.min(width, height) / 900))

  // 单片花瓣的初始状态
  const createPetal = (scattered = false) => {
    const sizeFactor = getSizeFactor()
    const scale = rand(0.45, 1)

    return {
      x: rand(-60, width + 60),
      // scattered=true 用于首屏：均匀撒在视口里，避免一开始空荡荡
      y: scattered ? rand(-height, height) : rand(-140, -20),
      scale,
      size: 40 * scale * sizeFactor,
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.012, 0.012),
      vy: rand(0.5, 1.25) * (0.6 + scale * 0.4),
      vx: rand(-0.42, 0.18),
      swayAmp: rand(12, 36),
      swayFreq: rand(0.0006, 0.0017),
      swayPhase: rand(0, Math.PI * 2),
      flip: rand(0, Math.PI * 2),
      flipSpeed: rand(0.002, 0.006),
      alpha: rand(0.5, 0.95),
      depth: rand(0.35, 1),
      t: rand(0, 8000)
    }
  }

  // 画出单片花瓣（带翻转、旋转、视差）
  const drawPetal = (petal) => {
    const sway =
      Math.sin(petal.t * petal.swayFreq + petal.swayPhase) * petal.swayAmp
    const x = petal.x + sway + pointer.x * 22 * petal.depth
    const y = petal.y + pointer.y * 14 * petal.depth

    // 用 cos 模拟花瓣在空中翻转，接近 0 时最窄，看起来像侧过去了
    const flip = Math.cos(petal.flip)
    const squash = 0.25 + Math.abs(flip) * 0.75

    ctx.save()
    ctx.globalAlpha = petal.alpha
    ctx.translate(x, y)
    ctx.rotate(petal.rot)
    ctx.scale(flip < 0 ? -squash : squash, 1)
    ctx.drawImage(
      petal.img,
      -petal.size / 2,
      -petal.size / 2,
      petal.size,
      petal.size
    )
    ctx.restore()
  }

  // 更新位置；飞出视口后从顶部 / 右侧重新进场
  const updatePetal = (petal, delta) => {
    petal.t += delta
    petal.y += petal.vy * delta * speedScale
    petal.x += petal.vx * delta * speedScale
    petal.rot += petal.spin * delta * speedScale
    petal.flip += petal.flipSpeed * delta * speedScale

    const overflow = petal.size
    if (
      petal.y - overflow > height ||
      petal.x < -overflow * 2 ||
      petal.x > width + overflow * 2
    ) {
      // 2 成概率从右侧飘回来，其余从顶部重新落下，分布更自然
      const respawn = createPetal(false)
      if (Math.random() > 0.8) {
        respawn.x = width + overflow
        respawn.y = rand(0, height * 0.8)
      }
      Object.assign(petal, respawn)
    }
  }

  const frame = (time) => {
    rafId = requestAnimationFrame(frame)
    if (!ctx) return

    const delta = lastTime ? Math.min((time - lastTime) / 16.667, 3) : 1
    lastTime = time

    // 指针缓动，视差更柔和
    pointer.x += (pointer.tx - pointer.x) * 0.06
    pointer.y += (pointer.ty - pointer.y) * 0.06

    ctx.clearRect(0, 0, width, height)

    for (let i = 0; i < petals.length; i++) {
      const petal = petals[i]
      updatePetal(petal, delta)
      drawPetal(petal)
    }
  }

  const stop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    lastTime = 0
  }

  const start = () => {
    if (rafId || suspended || document.hidden) return
    lastTime = 0
    rafId = requestAnimationFrame(frame)
  }

  // 视口变化：重设画布分辨率、调整花瓣数量
  const resize = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    width = window.innerWidth
    height = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const target = getCount()
    if (petals.length > target) {
      petals.length = target
    } else {
      while (petals.length < target) {
        const petal = createPetal(true)
        petal.img = img
        petals.push(petal)
      }
    }

    // 尺寸变化后重新计算花瓣大小，并夹回视口内
    const sizeFactor = getSizeFactor()
    petals.forEach((petal) => {
      petal.size = 40 * petal.scale * sizeFactor
      petal.x = Math.min(petal.x, width + petal.size)
      petal.y = Math.min(petal.y, height + petal.size)
    })
  }

  const onPointerMove = (event) => {
    pointer.tx = (event.clientX / width) * 2 - 1
    pointer.ty = (event.clientY / height) * 2 - 1
  }

  const onPointerLeave = () => {
    pointer.tx = 0
    pointer.ty = 0
  }

  const onVisibilityChange = () => {
    if (document.hidden) stop()
    else start()
  }

  // 生日蛋糕等全屏特效出现时暂停，避免两个动画循环同时跑
  const onEffectToggle = (event) => {
    suspended = event.type === 'birthday:show'
    if (suspended) stop()
    else start()
  }

  // 窗口尺寸变化做防抖，避免拖动窗口时反复重建画布
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 150)
  }

  onMounted(() => {
    const canvas = canvasRef.value
    if (!canvas) return

    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    // 系统开启「减少动态效果」时放慢，但不完全去掉装饰
    speedScale = reducedMotion ? 0.4 : 1

    img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      resize()
      start()
    }
    img.onerror = () => {
      console.warn('花瓣图片加载失败，已跳过花瓣特效')
    }

    // 图片走独立请求异步加载：不占主包体积，也不阻塞页面首屏
    fetch('/float.base64', { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        img.src = text.trim()
      })
      .catch(() => {
        console.warn('花瓣请求失败，已跳过花瓣特效')
      })

    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('birthday:show', onEffectToggle)
    window.addEventListener('birthday:hide', onEffectToggle)

    if (props.interactive) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerleave', onPointerLeave)
    }
  })

  onBeforeUnmount(() => {
    stop()
    clearTimeout(resizeTimer)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('birthday:show', onEffectToggle)
    window.removeEventListener('birthday:hide', onEffectToggle)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerleave', onPointerLeave)
    petals = []
    ctx = null
  })

  return { canvasRef }
}
