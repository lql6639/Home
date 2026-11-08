<template>
  <APlayer
    v-if="playList[0]"
    ref="player"
    :audio="playList"
    :autoplay="store.playerAutoplay"
    :theme="theme"
    :autoSwitch="false"
    :loop="store.playerLoop"
    :order="store.playerOrder"
    :volume="volume"
    :showLrc="true"
    :listFolded="listFolded"
    :listMaxHeight="listMaxHeight"
    :noticeSwitch="false"
    @play="onPlay"
    @pause="onPause"
    @timeupdate="onTimeUp"
    @error="loadMusicError"
  />
</template>

<script setup>
import { MusicOne, PlayWrong } from '@icon-park/vue-next'
import { getPlayerList } from '@/api'
import { mainStore } from '@/store'
import APlayer from '@worstone/vue-aplayer'

const store = mainStore()

// 获取播放器 DOM
const player = ref(null)

// 歌曲播放列表
const playList = ref([])

// 接口真实拉回来的歌单。生日期间 playList 会被换成单曲，原列表靠它保住
const sourceList = ref([])

// 是否处于生日模式（生日歌把列表顶掉时，接口回包不能覆盖）
let birthdayActive = false

// 歌曲播放项
const playIndex = ref(0)

// 配置项
const props = defineProps({
  // 主题色
  theme: {
    type: String,
    default: '#efefef'
  },
  // 默认音量
  volume: {
    type: Number,
    default: 0.8,
    validator: (value) => {
      return value >= 0 && value <= 1
    }
  },
  // 歌曲服务器 ( netease-网易云, tencent-qq音乐 )
  songServer: {
    type: String,
    default: 'netease' //'netease' | 'tencent'
  },
  // 播放类型 ( song-歌曲, playlist-播放列表, album-专辑, search-搜索, artist-艺术家 )
  songType: {
    type: String,
    default: 'playlist'
  },
  // id
  songId: {
    type: String,
    default: '7452421335'
  },
  // 列表是否默认折叠
  listFolded: {
    type: Boolean,
    default: false
  },
  // 列表最大高度
  listMaxHeight: {
    type: Number,
    default: 420
  }
})

const listHeight = computed(() => {
  return props.listMaxHeight + 'px'
})

// 歌单拉取失败（接口 500、超时、返回空）
const showLoadError = () => {
  store.musicIsOk = false
  ElMessage({
    message: '播放器加载失败',
    grouping: true,
    icon: h(PlayWrong, {
      theme: 'filled',
      fill: '#efefef'
    })
  })
}

// 初始化播放器
onMounted(() => {
  nextTick(() => {
    getPlayerList(props.songServer, props.songType, props.songId)
      .then((res) => {
        // 接口挂了或歌单为空：别让播放器一直停在"加载中"
        if (!Array.isArray(res) || res.length === 0) {
          showLoadError()
          return
        }
        // 更改播放器加载状态
        store.musicIsOk = true
        // 生成歌单
        sourceList.value = res
        // 生日模式下列表已被生日歌顶掉，等关闭蛋糕时再还原
        if (!birthdayActive) playList.value = res
        nextTick(() => queueCenterLrc())
        console.log(
          '音乐加载完成',
          playIndex.value,
          playList.value.length,
          props.volume
        )
      })
      // fetch 的异常是异步抛的，外面那层 try/catch 抓不到，必须在这里兜
      .catch((err) => {
        console.error(err)
        showLoadError()
      })
  })
})

// 这首歌到底有没有真的响过。浏览器拒绝无交互自动播放时不会派发 play 事件，
// 所以它为 false 就等于「一次都没响过」，可以放心补播
let everPlayed = false

// 播放
const onPlay = () => {
  everPlayed = true
  playIndex.value = player.value.aplayer.index
  // 播放状态
  store.setPlayerState(player.value.audioRef.paused)
  // 储存播放器信息
  store.setPlayerData(
    playList.value[playIndex.value].name,
    playList.value[playIndex.value].artist
  )
  ElMessage({
    message: store.getPlayerData.name + ' - ' + store.getPlayerData.artist,
    grouping: true,
    icon: h(MusicOne, {
      theme: 'filled',
      fill: '#efefef'
    })
  })
}

// 暂停
const onPause = () => {
  store.setPlayerState(player.value.audioRef.paused)
}

// 音频时间更新事件
const onTimeUp = () => {
  let lyrics = player.value.aplayer.lyrics[playIndex.value]
  let lyricIndex = player.value.aplayer.lyricIndex
  if (!lyrics || !lyrics[lyricIndex]) {
    return
  }
  let lrc = lyrics[lyricIndex][1]
  if (lrc === 'Loading') {
    lrc = '歌词加载中'
  } else if (lrc === 'Not available') {
    lrc = '歌词加载失败'
  }
  store.setPlayerLrc(lrc)
}

// 切换播放暂停事件
const playToggle = () => {
  player.value.toggle()
}

// 切换音量事件
const changeVolume = (value) => {
  player.value.setVolume(value, false)
}

// 切换上下曲
const changeSong = (type) => {
  type === 0 ? player.value.skipBack() : player.value.skipForward()
  nextTick(() => {
    player.value.play()
    queueCenterLrc()
  })
}

// 切换歌曲列表状态
const toggleList = () => {
  player.value.toggleList()
  nextTick(() => queueCenterLrc())
}

// ---- 歌词：让正在唱的那一行停在框的垂直中间 ----
// 库只按 -index*16 平移，每行又固定 16px 高，所以当前行永远贴在框顶。
// 这里用 padding-top 补一段偏移：库每次重渲染只会重写 transform，
// 从不碰 padding，补偿不会被冲掉。
// 偏移直接算，不去量当前位置——切换行时库的 transform 是过渡过去的，
// 那一瞬间量到的是旧位置，会把补偿算成 0
const centerLrc = () => {
  const box = document.querySelector('.aplayer .aplayer-lrc')
  const contents = box?.querySelector('.aplayer-lrc-contents')
  const cur = contents?.querySelector('.aplayer-lrc-current')
  if (!box || !contents || !cur) return

  // 当前行自带 0.68rem 上下边距，没补偿时它就顶在框顶 + 这个边距的位置。
  // 库里 p 有 transition: all .5s，刚切行时 margin 还在从 0 过渡，量到的是 0，
  // 所以这里按样式里的设计值兜底（跟着根字号走）
  let marginTop = parseFloat(getComputedStyle(cur).marginTop) || 0
  if (marginTop === 0) {
    const rootFont = parseFloat(
      getComputedStyle(document.documentElement).fontSize
    )
    marginTop = (rootFont || 16) * 0.68
  }
  const pad = (box.clientHeight - cur.offsetHeight) / 2 - marginTop
  contents.style.paddingTop = pad > 0.5 ? `${pad}px` : '0px'
}

// 换行时库还没把新样式落到 DOM 上，当场算会读到上一行的边距，
// 所以下一帧再补一次
let lrcFrame = 0
const applyLrcCenter = () => {
  centerLrc()
  cancelAnimationFrame(lrcFrame)
  lrcFrame = requestAnimationFrame(centerLrc)
}

// 换行、缩放窗口都要重新居中
const onLrcResize = () => centerLrc()
watch(() => player.value?.aplayer?.lyricIndex, applyLrcCenter, {
  flush: 'post'
})

// 歌词是异步拉的，而且初始行号就是 0（不触发上面的 watch），
// 所以加载完、开合列表时各补几次，等库把行渲染出来
const queueCenterLrc = () => {
  centerLrc()
  setTimeout(centerLrc, 300)
  setTimeout(centerLrc, 1200)
}

// 加载音频错误
const loadMusicError = () => {
  let notice = ''
  if (playList.value.length > 1) {
    notice = '播放歌曲出现错误，播放器将在 2s 后进行下一首'
  } else {
    notice = '播放歌曲出现错误'
  }
  ElMessage({
    message: notice,
    grouping: true,
    icon: h(PlayWrong, {
      theme: 'filled',
      fill: '#EFEFEF',
      duration: 2000
    })
  })
  console.error(
    '播放歌曲: ' +
      player.value.aplayer.audio[player.value.aplayer.index].name +
      ' 出现错误'
  )
}

// ---- 自动播放被拦的兜底 ----
// 进页面没有用户交互，浏览器有时会直接把自动播放拒掉，库只会 console.warn 一声，
// 界面上什么都看不出来。点 Hot 打开列表是一次真实交互，正好借这次交互把歌接上。
// 已经在放、或者响过又被用户自己暂停的，都不动它
const playIfBlocked = () => {
  const p = player.value
  const audio = p?.audioRef
  // 生日歌有自己的兜底（playWhenAllowed），这里不插手
  if (!audio || birthdayActive) return
  // 本来就没开自动播放，别硬播
  if (!store.playerAutoplay) return
  // 正在放，或者响过之后被暂停了
  if (!audio.paused || everPlayed) return
  p.play()
}

// 暴露子组件方法
defineExpose({
  playToggle,
  changeVolume,
  changeSong,
  toggleList,
  playIfBlocked
})

// ---- 生日联动：进蛋糕时换成生日歌，关闭后连进度一起还原 ----
const BIRTHDAY_SONG_ID = '1963443271'

// 原曲序号 / 原进度 / 原播放状态，关闭时还原用
let backupIndex = 0
let backupTime = 0
let backupPlaying = false
// 进入生日模式时到底有没有「原曲」可还原（进页面就被接管时没有）
let backupValid = false
// 生日歌被浏览器的自动播放策略拦下了（一次都没响过）
let birthdayBlocked = false
// 被拦时挂上的「点一下补播」监听，退出生日模式要摘掉
let gestureRetry = null

const stopGestureRetry = () => {
  if (!gestureRetry) return
  document.removeEventListener('pointerdown', gestureRetry, true)
  document.removeEventListener('keydown', gestureRetry, true)
  gestureRetry = null
}

const buildBirthdaySong = () => ({
  name: '生日快乐',
  artist: '送给今天的你',
  url: `${import.meta.env.VITE_SONG_API}/?type=url&id=${BIRTHDAY_SONG_ID}`,
  // 用 data URL 当歌词，避免播放器再发一次真实网络请求
  lrc: `data:text/plain;charset=utf-8,${encodeURIComponent(
    '[00:00.00]生日快乐'
  )}`
})

// 切歌瞬间 duration 还是 0，直接 seek 会被夹成 0，所以等元数据就绪再拨回去
const seekWhenReady = (time) => {
  if (!time) return
  const startedAt = performance.now()
  const apply = () => {
    const audio = player.value?.audioRef
    if (!audio) return
    if (
      audio.readyState >= 1 &&
      Number.isFinite(audio.duration) &&
      audio.duration > 0
    ) {
      audio.currentTime = Math.min(time, Math.max(audio.duration - 0.3, 0))
      return
    }
    // 最多等 8s，等不到就放弃（例如原曲加载失败）
    if (performance.now() - startedAt < 8000) setTimeout(apply, 80)
  }
  apply()
}

// 自动播放可能被浏览器拦下（进页面没有用户交互）：等第一次点击/按键再补播
const playWhenAllowed = () => {
  const p = player.value
  if (!p) return
  p.play()

  const startedAt = performance.now()
  const check = () => {
    const audio = player.value?.audioRef
    // 已经退出蛋糕模式就不要再管了
    if (!audio || !birthdayActive) return
    // 已经响起来了，浏览器没拦
    if (!audio.paused) return
    // 还在缓冲（readyState < 2），过一会儿再看，别急着判定成被拦
    if (audio.readyState < 2 && performance.now() - startedAt < 3000) {
      setTimeout(check, 200)
      return
    }

    // 确实没在播：记下来，关闭时用那次点击把原曲接着播
    birthdayBlocked = true
    const retry = (e) => {
      stopGestureRetry()
      if (!birthdayActive) return
      // 关闭按钮那一下不算：它交给 leaveBirthday，用这次交互恢复原曲
      const el = e.target
      if (el instanceof Element && el.closest('.birthday .close')) return
      if (player.value?.audioRef?.paused) player.value.play()
    }
    gestureRetry = retry
    document.addEventListener('pointerdown', retry, true)
    document.addEventListener('keydown', retry, true)
  }
  setTimeout(check, 600)
}

const enterBirthday = () => {
  if (birthdayActive) return
  birthdayActive = true
  birthdayBlocked = false

  const p = player.value
  if (p && p.aplayer) {
    backupValid = true
    backupIndex = p.aplayer.index || 0
    backupTime = p.audioRef?.currentTime || 0
    backupPlaying = !p.audioRef?.paused
    // 先清空，让歌词缓存一起重置，否则会沿用原歌的歌词
    p.clearList()
  } else {
    // 进页面就自动放蛋糕时播放器还没挂载：按站点自己的自动播放设置来，
    // 原来该自动播的，关掉蛋糕后就接着播
    backupValid = false
    backupIndex = 0
    backupTime = 0
    backupPlaying = store.playerAutoplay
  }

  playList.value = [buildBirthdaySong()]
  nextTick(() => playWhenAllowed())
}

const leaveBirthday = (e) => {
  // 当天结束只撤蛋糕画面，生日歌继续放（e.detail.keepMusic），这里不还原歌单
  if (e?.detail?.keepMusic) return
  if (!birthdayActive) return
  birthdayActive = false
  stopGestureRetry()

  const p = player.value
  const list = sourceList.value
  const index = backupIndex
  const time = backupTime
  // 生日歌一次都没响过说明被自动播放策略拦了，这次点击（关闭）正好是交互，
  // 用这次交互把原曲接着播；本来就该暂停的，仍然保持暂停
  const playing = backupPlaying || birthdayBlocked

  // 原歌单还没回来（或接口挂了）：等接口回包时由 onMounted 里的判断挂载
  if (!p || !p.aplayer || !list.length) {
    playList.value = list
    return
  }

  p.clearList()
  playList.value = list
  nextTick(() => {
    const pl = player.value
    if (backupValid) {
      // 有原曲：切回去，进度也拨回去
      pl.switchList(index)
      seekWhenReady(time)
    } else if (
      pl?.aplayer?.order === 'random' &&
      pl.aplayer.randomOrder?.length
    ) {
      // 生日模式是进页面就接管的，没有原曲可还原。
      // 这时不能停在 0，否则每次关掉蛋糕都从歌单第一首开始，随机播放就废了
      pl.switchList(pl.aplayer.randomOrder[0])
    }
    playing ? pl.play() : pl.pause()
  })
}

onMounted(() => {
  window.addEventListener('birthday:show', enterBirthday)
  window.addEventListener('birthday:hide', leaveBirthday)
  // 窗口尺寸变了，歌词框的高度/行宽都会变，重新居中
  window.addEventListener('resize', onLrcResize)
  // 生日蛋糕比播放器先挂载，这里主动问一次：如果正放着蛋糕，把生日歌换上
  window.dispatchEvent(new Event('birthday:query'))
})

onBeforeUnmount(() => {
  stopGestureRetry()
  cancelAnimationFrame(lrcFrame)
  window.removeEventListener('birthday:show', enterBirthday)
  window.removeEventListener('birthday:hide', leaveBirthday)
  window.removeEventListener('resize', onLrcResize)
})
</script>

<style lang="scss" scoped>
.aplayer {
  width: 80%;
  border-radius: 6px;
  font-family: 'HarmonyOS_Regular', sans-serif !important;

  :deep(.aplayer-body) {
    background-color: transparent;

    .aplayer-pic {
      display: none;
    }

    .aplayer-info {
      margin-left: 0;
      background-color: #ffffff40;
      border-color: transparent !important;
      height: auto !important; // 库默认写死 90px，歌词加高后必须自适应，否则内容溢出叠到列表上

      .aplayer-music {
        flex-grow: initial;
        margin-bottom: 1rem;
        overflow: initial;

        .aplayer-title {
          margin-right: 0px;
        }

        .aplayer-author {
          color: #ffffff;
        }
      }

      .aplayer-lrc {
        text-align: left;
        margin: 7px 0 17px 7px;
        height: 68px;
        mask: linear-gradient(
          #fff 10%,
          #fff 90%,
          hsla(0deg, 0%, 100%, 0.6) 95%,
          hsla(0deg, 0%, 100%, 0)
        );
        -webkit-mask: linear-gradient(
          #fff 10%,
          #fff 90%,
          hsla(0deg, 0%, 100%, 0.6) 95%,
          hsla(0deg, 0%, 100%, 0)
        );

        &::before,
        &::after {
          display: none;
        }

        p {
          color: #efefef;
        }

        .aplayer-lrc-current {
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          margin: 0.68rem 0 !important;
        }
      }

      .aplayer-controller {
        display: none;
      }
    }
  }

  :deep(.aplayer-list) {
    margin-top: 10px;
    height: v-bind(listHeight);
    background-color: transparent;

    ol {
      &::-webkit-scrollbar-track {
        background-color: transparent;
      }

      li {
        border-color: transparent;

        &.aplayer-list-light {
          background: #ffffff40;
          border-radius: 6px;
        }

        &:hover {
          background: #ffffff26 !important;
          border-radius: 6px !important;
        }

        .aplayer-list-index,
        .aplayer-list-author {
          color: #efefef;
        }
      }
    }
  }
}
</style>
