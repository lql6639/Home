<template>
  <Transition name="slide-up">
    <div v-if="hasUpdate" class="update-tip">
      <div class="dot" />
      <span class="text">发现新版本，刷新后生效</span>
      <button class="btn primary" @click="applyUpdate">立即更新</button>
      <button class="btn" @click="ignoreUpdate">稍后</button>
    </div>
  </Transition>
</template>

<script setup>
import { onMounted } from 'vue'
import { hasUpdate, ignoreUpdate, applyUpdate, startUpdateWatcher } from '@/utils/update.js'

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
  max-width: calc(100vw - 32px);

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #67c23a;
    flex-shrink: 0;
  }

  .text {
    flex-shrink: 0;
  }

  .btn {
    padding: 4px 12px;
    border: none;
    border-radius: 8px;
    background: rgb(255 255 255 / 14%);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
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
