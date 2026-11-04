<template>
  <Transition name="slide-up">
    <div v-if="hasUpdate" ref="tipRef" class="update-tip">
      <div class="dot" />
      <span class="text">页面有更新，刷新后生效</span>
      <button class="btn primary" @click="applyUpdate">刷新</button>
      <button class="btn" @click="ignoreUpdate">稍后</button>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import {
  hasUpdate,
  ignoreUpdate,
  applyUpdate,
  startUpdateWatcher
} from '@/utils/update.js'
import { useBottomTipStack } from '@/utils/tipStack.js'

// 底部提示条共用一套堆叠规则：先出现的贴底，后来的往上叠
const tipRef = ref(null)
useBottomTipStack('update', hasUpdate, tipRef)

onMounted(() => {
  startUpdateWatcher()
})
</script>

<style lang="scss" scoped>
.update-tip {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(40, 40, 40, 0.86);
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 24px rgb(0 0 0 / 18%);
  color: #fff;
  font-size: 14px;
  /* left:50% 会把绝对定位元素的可用宽度砍掉一半，这里显式按内容撑开 */
  width: max-content;
  max-width: calc(100vw - 32px);

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #67c23a;
    flex-shrink: 0;
  }

  .text {
    flex-shrink: 1;
    min-width: 0;
  }

  .btn {
    padding: 4px 12px;
    border: none;
    border-radius: 8px;
    background: rgb(255 255 255 / 14%);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: rgb(255 255 255 / 24%);
    }

    &.primary {
      background: #409eff;

      &:hover {
        background: #66b1ff;
      }
    }
  }

  @media (max-width: 768px) {
    bottom: 16px;
    padding: 8px 12px;
    gap: 8px;

    .text {
      font-size: 13px;
    }
  }
}

/* 已经落位过，之后的上下位移走过渡 */
.update-tip.tip-stacked {
  transition: bottom 0.3s ease;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
