<template>
  <div :class="store.backgroundShow ? 'cover show' : 'cover'">
    <img
      v-show="store.imgLoadStatus"
      :src="bgUrl"
      class="bg"
      alt="cover"
      @load="imgLoadComplete"
      @error="imgLoadError"
      @animationend="imgAnimationEnd"
    />
    <div :class="store.backgroundShow ? 'gray hidden' : 'gray'" />
    <Transition name="fade" mode="out-in">
      <a
        v-if="store.backgroundShow && store.coverType != '3'"
        class="down"
        :href="bgUrl"
        target="_blank"
      >
        下载壁纸
      </a>
    </Transition>
  </div>
</template>

<script setup>
import { mainStore } from '@/store'
import { Error } from '@icon-park/vue-next'

const store = mainStore()
const bgUrl = ref(null)
const imgTimeout = ref(null)
// 图片迟迟不响应时的强制放行定时器
const hardTimeout = ref(null)
const emit = defineEmits(['loadComplete'])
const mainUrl = import.meta.env.VITE_EXTERNAL_BACKGROUND_URL

// 壁纸随机数
// 请依据文件夹内的图片个数修改 Math.random() 后面的第一个数字
const bgRandom = Math.floor(Math.random() * 10 + 1)

// 最晚多久放行加载层。远程壁纸有 1.6~3MB，网络慢时能拖到十几秒，
// 而图片请求卡死时 @load / @error 都不会触发，加载层会一直转
const LOAD_TIMEOUT = 6000

// 放行加载层（幂等：先到先得，后面的调用直接忽略）
const reveal = () => {
  if (store.imgLoadStatus) return
  store.setImgLoadStatus(true)
}

// 兜底是否已经用过，避免图片反复报错时循环切换
let fallbackTried = false

// 更换壁纸链接
const changeBg = (type) => {
  if (type == 0) {
    if (mainUrl) {
      bgUrl.value = mainUrl.replace('{bgrandom}', bgRandom)
    } else {
      bgUrl.value = `/home-image/background${bgRandom}.jpg`
    }
  } else if (type == 1) {
    bgUrl.value = 'https://api.imlazy.ink/img'
  }
}

// 图片加载完成
const imgLoadComplete = () => {
  clearTimeout(hardTimeout.value)
  imgTimeout.value = setTimeout(
    reveal,
    Math.floor(Math.random() * (600 - 300 + 1)) + 300
  )
}

// 图片动画完成
const imgAnimationEnd = () => {
  console.log('壁纸加载动画完成')
  // 加载完成事件
  emit('loadComplete')
}

// 图片显示失败
const imgLoadError = () => {
  console.error('壁纸加载失败：', bgUrl.value)
  // 兜底图固定用 background1.jpg，本地一定有，最多试一次
  if (!fallbackTried) {
    fallbackTried = true
    ElMessage({
      message: '壁纸加载失败，已临时切换回默认',
      icon: h(Error, {
        theme: 'filled',
        fill: '#efefef'
      })
    })
    bgUrl.value = '/home-image/background1.jpg'
    return
  }
  // 本地兜底也挂了：直接放行，别让加载层一直转
  reveal()
}

// 监听壁纸切换
watch(
  () => store.coverType,
  (value) => {
    changeBg(value)
  }
)

onMounted(() => {
  // 加载壁纸
  changeBg(store.coverType)
  // 无论图片有没有回来，最晚 6s 也要把页面放出来
  hardTimeout.value = setTimeout(reveal, LOAD_TIMEOUT)
})

onBeforeUnmount(() => {
  clearTimeout(imgTimeout.value)
  clearTimeout(hardTimeout.value)
})
</script>

<style lang="scss" scoped>
.cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: 0.25s;
  z-index: -1;

  &.show {
    z-index: 1;
  }

  .bg {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    backface-visibility: hidden;
    filter: blur(20px) brightness(0.3);
    transition:
      filter 0.3s,
      transform 0.3s;
    animation: fade-blur-in 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    animation-delay: 0.45s;
  }

  .gray {
    opacity: 1;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-image:
      radial-gradient(rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.5) 100%),
      radial-gradient(rgba(0, 0, 0, 0) 33%, rgba(0, 0, 0, 0.3) 166%);

    transition: 1.5s;

    &.hidden {
      opacity: 0;
      transition: 1.5s;
    }
  }

  .down {
    font-size: 16px;
    color: white;
    position: absolute;
    bottom: 30px;
    left: 0;
    right: 0;
    margin: 0 auto;
    display: block;
    padding: 20px 26px;
    border-radius: 8px;
    background-color: #00000030;
    width: 120px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;

    &:hover {
      transform: scale(1.05);
      background-color: #00000060;
    }

    &:active {
      transform: scale(1);
    }
  }
}
</style>
