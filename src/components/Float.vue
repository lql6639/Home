<template>
  <!-- 花瓣漂浮特效：纯装饰层，不拦截鼠标事件 -->
  <canvas ref="canvasRef" class="float-canvas" aria-hidden="true" />
</template>

<script setup>
import { useFloat } from '@/utils/float.js'

const props = defineProps({
  // 密度倍率，1 为默认；想更密就传 1.5，更疏就 0.6
  density: {
    type: Number,
    default: 1
  },
  // 鼠标移动时花瓣是否有轻微视差
  interactive: {
    type: Boolean,
    default: true
  }
})

// 逻辑全在 useFloat 里：花瓣采样、绘制循环、视差、暂停/恢复
const { canvasRef } = useFloat(props)
</script>

<style lang="scss" scoped>
.float-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  z-index: 1;
}
</style>
