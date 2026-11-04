<template>
  <!-- 生日当天的底部祝福条：蛋糕关掉后一直留在这里，点按钮可以再看一次 -->
  <Transition name="slide-up">
    <div v-if="tipVisible" ref="tipRef" class="birthday-tip">
      <div class="dot" />
      <span class="text">收到一份生日祝福</span>
      <button class="btn primary" type="button" @click="openCake">接收</button>
    </div>
  </Transition>

  <!-- alive 为 false 时整块 DOM 被移除，canvas 显存随之释放 -->
  <Transition v-if="alive" name="birthday-fade" @after-leave="destroy">
    <div v-if="visible" class="birthday">
      <canvas ref="canvasRef" class="cake-canvas" aria-hidden="true" />

      <div class="wish">
        <p class="title">生日快乐</p>
        <p class="sub">成长不期而遇 生日如期而至 生日快乐</p>
      </div>

      <button class="close" type="button" @click="close">关闭</button>
    </div>
  </Transition>
</template>

<script setup>
import { useCake } from '@/utils/cake.js'

// 逻辑全在 useCake 里：canvas 动画、开关、当天的时间调度、底部祝福条
const {
  canvasRef,
  visible,
  alive,
  tipVisible,
  tipRef,
  openCake,
  close,
  destroy
} = useCake()
</script>

<style lang="scss" scoped>
.birthday {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  background:
    radial-gradient(
      circle at 50% 50%,
      rgba(255, 178, 104, 0.18),
      rgba(255, 126, 62, 0.07) 34%,
      transparent 64%
    ),
    rgba(8, 8, 14, 0.66);
  /* 不用 backdrop-filter：整页 blur 会让这一层每帧重新合成，掉 10fps 左右 */
  z-index: 60;
  overflow: hidden;

  .cake-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .wish {
    position: relative;
    margin-bottom: 5vh;
    text-align: center;
    pointer-events: none;
    animation: wish-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) 1.6s both;

    .title {
      font-family: 'HarmonyOS_Regular', sans-serif;
      font-size: clamp(1.5rem, 4.2vw, 2.6rem);
      letter-spacing: 0.3em;
      text-indent: 0.3em;
      color: #fff4e6;
      text-shadow:
        0 0 18px rgba(255, 176, 108, 0.75),
        0 0 60px rgba(255, 140, 70, 0.45);
    }

    .sub {
      margin-top: 0.7rem;
      font-size: 0.85rem;
      letter-spacing: 0.12em;
      color: rgba(255, 238, 220, 0.88);
      text-shadow: 0 1px 10px rgba(0, 0, 0, 0.55);
    }
  }

  .close {
    position: absolute;
    right: 1.5rem;
    top: 1.5rem;
    padding: 0.45rem 1.1rem;
    font-family: inherit;
    font-size: 0.8rem;
    color: rgba(255, 240, 226, 0.8);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 220, 190, 0.18);
    border-radius: 999px;
    cursor: pointer;
    transition: 0.25s;

    &:hover {
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
    }
  }

  @media (max-width: 720px) {
    .wish {
      margin-bottom: 8vh;
    }

    .close {
      right: 1rem;
      top: 1rem;
    }
  }
}

.birthday-fade-enter-active,
.birthday-fade-leave-active {
  transition: opacity 0.6s ease;
}

.birthday-fade-enter-from,
.birthday-fade-leave-to {
  opacity: 0;
}

/* 提示条：与 UpdateTip 同一套观感 */
.birthday-tip {
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
    background: #f4a759;
    flex-shrink: 0;
    box-shadow: 0 0 8px #f4a759;
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
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: rgb(255 255 255 / 24%);
    }

    &.primary {
      background: #f4a759;

      &:hover {
        background: #ffbb78;
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
.birthday-tip.tip-stacked {
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

@keyframes wish-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
