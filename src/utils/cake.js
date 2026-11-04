import { h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { GithubOne } from '@icon-park/vue-next'
import { isBirthday } from './time.js'
import { useBottomTipStack } from './tipStack.js'
import { mainStore } from '@/store'

/**
 * 生日蛋糕：canvas 动画 + 开关 + 当天的时间调度 + 底部祝福条
 * 组件里只留模板和样式，逻辑全部在这里
 */

export function useCake() {
  const store = mainStore()

  const canvasRef = ref(null)
  const visible = ref(false)
  // 关闭动画结束后置为 false，把整个组件从页面上摘掉
  const alive = ref(true)
  // 生日提示条
  const tipVisible = ref(false)
  // 底部提示条和「页面有更新」共用一套堆叠：先出现的贴底，后来的往上叠
  const tipRef = ref(null)
  useBottomTipStack('birthday', tipVisible, tipRef)

  // ---- 常量 ----
  const TAU = Math.PI * 2
  const FOCAL = 4.2 // 透视焦距（蛋糕单位）
  const MORPH_MS = 2600 // 聚合动画时长
  const IDLE_SPIN = 0.00013 // 聚合完成后的自转速度（弧度/毫秒）
  const CENTER_Y = 0.46 // 蛋糕中心在视口中的纵向位置，越小越靠上
  const MAX_DPR = 1 // 光点特效按 1x 渲染，Retina 上省一半以上填充像素

  // 三档暖色：主体橙、亮部米白、烛焰奶黄
  const CAKE_COLORS = ['255,150,70', '255,196,130', '255,236,210']
  const FLAME_COLORS = ['255,244,205', '255,206,120', '255,170,80']
  const CANDLE_COLORS = ['255,214,160', '255,238,205']
  const PLATE_COLORS = ['255,170,110', '255,205,160']

  // 去重成一张调色板：粒子按颜色排序，每帧只需切换十次 strokeStyle
  const PALETTE = [
    ...new Set([
      ...CAKE_COLORS,
      ...FLAME_COLORS,
      ...CANDLE_COLORS,
      ...PLATE_COLORS
    ])
  ]
  const STYLES = PALETTE.map((c) => `rgba(${c},1)`)
  const colorIndex = (c) => PALETTE.indexOf(c)

  // 亮度分 6 档：每帧把粒子按「颜色 + 亮度档」归桶，一个桶只描一次边
  const BANDS = 6
  const BUCKET_COUNT = PALETTE.length * BANDS
  let buckets = Array.from({ length: BUCKET_COUNT }, () => [])
  // 预分配的坐标缓冲，避免每帧产生垃圾
  let bx1 = null
  let by1 = null
  let bx2 = null
  let by2 = null

  // ---- 状态 ----
  let ctx = null
  let rafId = 0
  let width = 0
  let height = 0
  let dpr = 1
  let unitScale = 200
  let orbitMin = 1.3
  let orbitMax = 2.1
  let startTime = 0
  let particles = []
  let orbiters = []
  let embers = []
  let reducedMotion = false
  // 跨到第二天 0 点时重新判断一次
  let midnightTimer = 0
  // 当天 23:30 弹告别提示，次日 00:15 提示自动消失（不刷新页面）
  const FAREWELL_HOUR = 23
  const FAREWELL_MINUTE = 30
  const FAREWELL_END_HOUR = 0
  const FAREWELL_END_MINUTE = 15
  let farewellTimer = 0
  let farewellStarted = false
  // 静态辉光预渲染，避免每帧重建两个全屏径向渐变
  let backdrop = null

  const rand = (min, max) => min + Math.random() * (max - min)
  const pick = (arr) => arr[(Math.random() * arr.length) | 0]
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
  const easeOut = (t) => 1 - Math.pow(1 - t, 3)

  // ---- 蛋糕粒子采样 ----
  const sampleSide = (out, count, radius, y0, y1, colors) => {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU)
      const r = radius * rand(0.985, 1.015)
      out.push({
        tx: Math.cos(a) * r,
        ty: rand(y0, y1),
        tz: Math.sin(a) * r,
        ci: colorIndex(pick(colors)),
        kind: 'cake'
      })
    }
  }

  const sampleDisc = (out, count, radius, y, colors, rimOnly = false) => {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU)
      const r = rimOnly
        ? radius * rand(0.92, 1.02)
        : radius * Math.sqrt(Math.random())
      // 顶面微微隆起，做出奶油拱形的感觉
      const dome = rimOnly ? 0 : 0.11 * (1 - (r / radius) ** 2)
      out.push({
        tx: Math.cos(a) * r,
        ty: y + dome,
        tz: Math.sin(a) * r,
        ci: colorIndex(pick(colors)),
        kind: 'cake'
      })
    }
  }

  const buildParticles = (total) => {
    const list = []
    sampleDisc(list, Math.round(total * 0.05), 1.2, -0.99, PLATE_COLORS, true)
    sampleSide(list, Math.round(total * 0.3), 1.0, -0.95, -0.45, CAKE_COLORS)
    sampleDisc(list, Math.round(total * 0.1), 1.0, -0.45, CAKE_COLORS)
    sampleSide(list, Math.round(total * 0.22), 0.72, -0.45, 0.05, CAKE_COLORS)
    sampleDisc(list, Math.round(total * 0.1), 0.72, 0.05, CAKE_COLORS)
    sampleSide(list, Math.round(total * 0.07), 0.062, 0.05, 0.58, CANDLE_COLORS)

    // 蜡烛火焰：水滴形分布
    const flameCount = Math.round(total * 0.16)
    for (let i = 0; i < flameCount; i++) {
      const h = Math.pow(Math.random(), 0.7)
      const spread = 0.075 * (1 - h) + 0.012
      const a = rand(0, TAU)
      const r = spread * Math.sqrt(Math.random())
      list.push({
        tx: Math.cos(a) * r,
        ty: 0.6 + h * 0.22,
        tz: Math.sin(a) * r,
        ci: colorIndex(pick(FLAME_COLORS)),
        kind: 'flame'
      })
    }

    // 同色相邻只是为了让归桶更连续，渲染顺序由桶决定
    list.sort((a, b) => a.ci - b.ci)
    return list
  }

  const initParticles = () => {
    const count = width < 720 ? 2200 : 4600
    particles = buildParticles(count).map((p) => {
      const a = rand(0, TAU)
      const b = Math.acos(rand(-1, 1))
      const r = rand(1.4, 3.4)
      return {
        ...p,
        sx: r * Math.sin(b) * Math.cos(a),
        sy: r * Math.cos(b) * 0.7,
        sz: r * Math.sin(b) * Math.sin(a),
        dx: rand(-0.035, 0.035),
        dy: rand(-0.035, 0.035),
        dz: rand(-0.035, 0.035),
        delay: reducedMotion ? 0 : rand(0, 700),
        phase: rand(0, TAU),
        alpha: rand(0.35, 1)
      }
    })

    bx1 = new Float32Array(particles.length)
    by1 = new Float32Array(particles.length)
    bx2 = new Float32Array(particles.length)
    by2 = new Float32Array(particles.length)

    // 火焰周围飘散的火星
    embers = Array.from({ length: width < 720 ? 26 : 60 }, () => ({
      x: rand(-0.12, 0.12),
      z: rand(-0.12, 0.12),
      speed: rand(0.25, 0.6),
      offset: Math.random(),
      size: rand(1, 2.4),
      ci: colorIndex(pick(FLAME_COLORS))
    }))
  }

  // ---- 环绕蛋糕旋转的光点 ----
  const initOrbiters = () => {
    const count = width < 720 ? 54 : 110
    orbiters = Array.from({ length: count }, () => {
      const r = rand(orbitMin, orbitMax)
      return {
        a: rand(0, TAU),
        r,
        // 外圈慢、内圈快，方向随机，看起来像围绕蛋糕悬浮的光尘
        speed: (rand(0.00016, 0.00034) / r) * (Math.random() > 0.5 ? 1 : -1),
        y: rand(-0.15, 1.0),
        bobAmp: rand(0.03, 0.11),
        bobFreq: rand(0.0004, 0.001),
        bobPhase: rand(0, TAU),
        size: rand(0.9, 2.2),
        ci: colorIndex(pick(FLAME_COLORS)),
        twPhase: rand(0, TAU),
        twSpeed: rand(0.002, 0.005)
      }
    })
  }

  // front = true 画在蛋糕前面，false 画在后面
  const drawOrbiters = (now, cosR, sinR, cx, cy, front) => {
    const boost = width < 720 ? 1.15 : 1

    for (let i = 0; i < orbiters.length; i++) {
      const o = orbiters[i]
      const ang = o.a + now * o.speed
      const ox = Math.cos(ang) * o.r
      const oz = Math.sin(ang) * o.r

      // 跟着蛋糕一起自转，前后层次才不会打架
      const rx = ox * cosR - oz * sinR
      const rz = ox * sinR + oz * cosR

      // rz < 0 表示靠近镜头
      const isFront = rz < 0
      if (isFront !== front) continue

      const oy = o.y + Math.sin(now * o.bobFreq + o.bobPhase) * o.bobAmp
      const persp = FOCAL / (FOCAL + rz)
      const sx = cx + rx * persp * unitScale
      const sy = cy - oy * persp * unitScale

      // 远处更暗更小，近处亮一点，空间感就出来了
      const depth = clamp01(0.34 + persp * 0.5)
      const twinkle = 0.55 + Math.sin(now * o.twSpeed + o.twPhase) * 0.45
      const radius = o.size * persp * boost

      ctx.fillStyle = STYLES[o.ci]
      // 外发光
      ctx.globalAlpha = 0.13 * depth * twinkle
      ctx.beginPath()
      ctx.arc(sx, sy, radius * 3.4, 0, TAU)
      ctx.fill()
      // 光点本体
      ctx.globalAlpha = 0.85 * depth * twinkle
      ctx.beginPath()
      ctx.arc(sx, sy, radius, 0, TAU)
      ctx.fill()
    }
  }

  // ---- 画布尺寸 / 静态辉光 ----
  const buildBackdrop = () => {
    // 半分辨率就够，辉光本身就是模糊的，省内存也省填充
    const scale = 0.5
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))

    const g = canvas.getContext('2d')
    g.setTransform(scale, 0, 0, scale, 0, 0)

    const cx = width / 2
    const cy = height * CENTER_Y

    // 蛋糕背后的暖色辉光
    const glowR = unitScale * 2.1
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, glowR)
    glow.addColorStop(0, 'rgba(255,180,110,0.20)')
    glow.addColorStop(0.45, 'rgba(255,130,70,0.09)')
    glow.addColorStop(1, 'rgba(255,110,60,0)')
    g.fillStyle = glow
    g.beginPath()
    g.arc(cx, cy, glowR, 0, TAU)
    g.fill()

    // 烛焰根部的高光
    const fy = cy - unitScale * 0.75
    const flameGlow = g.createRadialGradient(
      cx,
      fy,
      0,
      cx,
      fy,
      unitScale * 0.42
    )
    flameGlow.addColorStop(0, 'rgba(255,246,220,0.5)')
    flameGlow.addColorStop(0.5, 'rgba(255,170,90,0.18)')
    flameGlow.addColorStop(1, 'rgba(255,140,60,0)')
    g.fillStyle = flameGlow
    g.beginPath()
    g.arc(cx, fy, unitScale * 0.42, 0, TAU)
    g.fill()

    backdrop = canvas
  }

  const resize = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    width = window.innerWidth
    height = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 蛋糕占据短边约 60%，桌面和手机观感一致
    // 同时限制纵向占用：底部要留出文字位置，否则宽屏上蛋糕会压到「生日快乐」
    const minDim = Math.min(width, height)
    const textRoom = width < 720 ? 150 : 120
    const byHeight = ((1 - CENTER_Y) * height - textRoom) / 1.72
    unitScale = Math.max(
      minDim * 0.14,
      Math.min(minDim * (width < 720 ? 0.3 : 0.285), byHeight)
    )

    // 环绕半径不能超出屏幕两侧，手机自动收窄到蛋糕外沿一圈
    orbitMin = 1.3
    orbitMax = Math.max(orbitMin, Math.min(2.1, (width * 0.5 - 26) / unitScale))

    buildBackdrop()
    initParticles()
    initOrbiters()
    startTime = performance.now()
  }

  // ---- 每帧绘制 ----
  const drawFrame = (now) => {
    if (!ctx || !particles.length) return

    const elapsed = now - startTime
    const spin = reducedMotion ? 0 : elapsed * IDLE_SPIN
    const cosR = Math.cos(spin)
    const sinR = Math.sin(spin)
    const bob = reducedMotion ? 0 : Math.sin(now * 0.0011) * 0.028

    const cx = width / 2
    const cy = height * CENTER_Y

    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'lighter'

    if (backdrop) ctx.drawImage(backdrop, 0, 0, width, height)

    // 后排光点先画，被蛋糕挡住一部分，环绕的立体感才成立
    const orbitNow = reducedMotion ? 0 : now
    drawOrbiters(orbitNow, cosR, sinR, cx, cy, false)

    ctx.lineWidth = 1.1

    // A 段：算出每颗粒子的屏幕坐标与亮度档，先归桶但不绘制
    for (let i = 0; i < BUCKET_COUNT; i++) buckets[i].length = 0

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const t = easeOut(clamp01((elapsed - p.delay) / MORPH_MS))
      if (t <= 0) continue

      // 起点 → 蛋糕上的目标点
      let x = p.sx + (p.tx - p.sx) * t
      let y = p.sy + (p.ty - p.sy) * t
      let z = p.sz + (p.tz - p.sz) * t

      // 烛焰抖动
      if (p.kind === 'flame' && t > 0.85) {
        x += Math.sin(now * 0.012 + p.phase) * 0.012
        z += Math.cos(now * 0.009 + p.phase) * 0.012
      }

      // 自转 + 整体轻微上下浮动
      const rx = x * cosR - z * sinR
      const rz = x * sinR + z * cosR
      const ry = y + bob

      const persp = FOCAL / (FOCAL + rz)
      bx1[i] = cx + rx * persp * unitScale
      by1[i] = cy - ry * persp * unitScale

      // 线段方向同样跟着转，保证侧面看也是立体的
      const ex = bx1[i] + (p.dx * cosR - p.dz * sinR) * persp * unitScale
      const ey = by1[i] - p.dy * persp * unitScale
      bx2[i] = ex
      by2[i] = ey

      let alpha = p.alpha * (0.4 + persp * 0.7) * t
      if (p.kind === 'flame') {
        alpha *= 0.85 + Math.sin(now * 0.014 + p.phase) * 0.15
      }

      let band = (clamp01(alpha) * BANDS) | 0
      if (band >= BANDS) band = BANDS - 1
      buckets[p.ci * BANDS + band].push(i)
    }

    // B 段：每个桶一次描边，绘制调用从数千次降到 60 次
    for (let ci = 0; ci < PALETTE.length; ci++) {
      const base = ci * BANDS
      ctx.strokeStyle = STYLES[ci]
      for (let b = 0; b < BANDS; b++) {
        const list = buckets[base + b]
        if (!list.length) continue

        ctx.globalAlpha = (b + 0.5) / BANDS
        ctx.beginPath()
        for (let k = 0; k < list.length; k++) {
          const i = list[k]
          ctx.moveTo(bx1[i], by1[i])
          ctx.lineTo(bx2[i], by2[i])
        }
        ctx.stroke()
      }
    }

    drawOrbiters(orbitNow, cosR, sinR, cx, cy, true)

    // 火星：从火焰向上飘散
    if (elapsed > MORPH_MS * 0.8) {
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i]
        const prog = (now * 0.00018 * e.speed + e.offset) % 1
        const rx = e.x * cosR - e.z * sinR
        const rz = e.x * sinR + e.z * cosR
        const persp = FOCAL / (FOCAL + rz)
        const sx = cx + rx * persp * unitScale
        const sy = cy - (0.7 + prog * 0.95) * persp * unitScale

        ctx.fillStyle = STYLES[e.ci]
        ctx.globalAlpha = (1 - prog) * 0.75
        ctx.beginPath()
        ctx.arc(sx, sy, e.size * persp, 0, TAU)
        ctx.fill()
      }
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // 唯一的一条动画链：画完再排下一帧，绝不能在 drawFrame 里重复 requestAnimationFrame
  const loop = (now) => {
    drawFrame(now)
    rafId = requestAnimationFrame(loop)
  }

  const stop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  const start = () => {
    if (rafId || document.hidden || !visible.value || !ctx) return
    rafId = requestAnimationFrame(loop)
  }

  // 释放全部缓存，关闭后不留下任何还在跑的回调
  const release = () => {
    stop()
    particles = []
    orbiters = []
    embers = []
    buckets.forEach((b) => (b.length = 0))
    bx1 = null
    by1 = null
    bx2 = null
    by2 = null
    backdrop = null
    ctx = null
  }

  // 收掉蛋糕画面：keepMusic 为 true 时只收画面，生日歌继续放（当天结束用）
  const hideCake = (keepMusic) => {
    if (!visible.value) return
    visible.value = false

    // 停掉动画（画布保留最后一帧，靠 CSS 过渡淡出）并立刻交还 CPU
    release()
    // 通知花瓣特效恢复；keepMusic 时播放器不还原歌单
    window.dispatchEvent(
      new CustomEvent('birthday:hide', { detail: { keepMusic } })
    )
  }

  const close = () => {
    if (!visible.value) return
    hideCake(false)
    // 关掉后底部祝福一直保留到今天结束
    if (isBirthday()) showTip()
  }

  // 祝福条出现：等壁纸加载完、加载层收起后再冒头，免得压在加载动画上面
  const showTip = () => {
    if (store.imgLoadStatus) {
      tipVisible.value = true
      return
    }
    const stopWatch = watch(
      () => store.imgLoadStatus,
      (loaded) => {
        if (!loaded) return
        stopWatch()
        tipVisible.value = true
      }
    )
  }

  // 打开蛋糕：进页面、跨到零点、点「再看一次」都走这里
  const openCake = () => {
    if (visible.value) return
    tipVisible.value = false
    // after-leave 里会把 alive 置 false（整块 DOM 已摘掉），重新打开时要先挂回来
    alive.value = true
    visible.value = true
    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    // destroy 里解除过监听，重新打开时要补回来
    addListeners()

    nextTick(() => {
      resize()
      start()
    })

    // 花瓣特效暂停，播放器换生日歌，都听这个事件
    window.dispatchEvent(new Event('birthday:show'))
  }

  // 当天是生日就直接放蛋糕；过了当天只收蛋糕和祝福条，生日歌留着
  const checkToday = () => {
    if (isBirthday()) {
      // 进页面就放蛋糕：更新条在不在都一样
      openCake()
      return
    }
    // 过了当天：祝福条一定收掉（否则页面整夜开着会留着昨天的祝福）
    tipVisible.value = false
    // 蛋糕收掉，但歌可以继续听；00:15 提示消失后按原来的走
    hideCake(true)
  }

  // 到次日 00:15 的剩余毫秒：提示挂到这一刻自动消失
  const msUntilFarewellEnd = () => {
    const now = new Date()
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      FAREWELL_END_HOUR,
      FAREWELL_END_MINUTE,
      2
    ).getTime()
    return Math.max(1500, at - now.getTime())
  }

  // 23:30 弹两条告别提示：一直挂到次日 00:15，零点撤蛋糕时屏幕上不至于空场
  const startFarewell = () => {
    if (farewellStarted) return
    farewellStarted = true

    const left = msUntilFarewellEnd()
    ElMessage({
      message: '结束寄语',
      duration: left,
      icon: h(GithubOne, { theme: 'filled', fill: '#efefef' })
    })
    ElMessage({
      message: '希望你带着新的祝福开始新的一岁',
      duration: left,
      icon: h(GithubOne, { theme: 'filled', fill: '#efefef' })
    })
  }

  // 到 23:30 弹提示；23:30 之后才进来的直接弹
  const scheduleFarewell = () => {
    if (!isBirthday()) return
    const now = new Date()
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      FAREWELL_HOUR,
      FAREWELL_MINUTE,
      0
    ).getTime()
    const delay = at - now.getTime()
    if (delay <= 0) startFarewell()
    else farewellTimer = setTimeout(startFarewell, delay)
  }

  // 页面一直开着时，跨到 0 点重新判断一次：到点自动放蛋糕，过了当天自动收掉
  const scheduleMidnight = () => {
    const now = new Date()
    const next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2
    )
    midnightTimer = setTimeout(() => {
      checkToday()
      scheduleMidnight()
    }, next.getTime() - now.getTime())
  }

  const onVisibility = () => {
    if (document.hidden) stop()
    else start()
  }

  const onResize = () => {
    // 已经关闭 / 已销毁时不再重建
    if (!visible.value) return
    resize()
    startTime = performance.now() - MORPH_MS * 4 // 缩放后直接呈现完成形态，避免重新聚合
  }

  const onKeydown = (e) => {
    if (e.key === 'Escape') close()
  }

  // 播放器挂载比这里晚（它在壁纸加载完才进 DOM），挂载后会来问一次当前要不要放生日歌
  const onQuery = () => {
    if (visible.value) window.dispatchEvent(new Event('birthday:show'))
  }

  // 重复调用无副作用：同一个函数引用只会注册一次
  const addListeners = () => {
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('birthday:query', onQuery)
    document.addEventListener('visibilitychange', onVisibility)
  }

  const removeListeners = () => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('birthday:query', onQuery)
    document.removeEventListener('visibilitychange', onVisibility)
  }

  // 淡出结束后真正卸载：摘掉 DOM、解除监听、释放 canvas 显存
  const destroy = () => {
    // 淡出途中又被「再看一次」打开时不能卸载
    if (visible.value) return
    release()
    removeListeners()
    canvasRef.value = null
    // 放到下一个 tick，避免在过渡钩子里直接移除过渡自身
    nextTick(() => {
      alive.value = false
    })
  }

  onMounted(() => {
    addListeners()
    checkToday()
    scheduleMidnight()
    scheduleFarewell()
  })

  onBeforeUnmount(() => {
    clearTimeout(midnightTimer)
    clearTimeout(farewellTimer)
    release()
    removeListeners()
    window.dispatchEvent(new Event('birthday:hide'))
  })

  return {
    canvasRef,
    visible,
    alive,
    tipVisible,
    tipRef,
    openCake,
    close,
    destroy
  }
}
