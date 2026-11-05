<template>
  <div :class="store.mobileOpenState ? 'right' : 'right hidden'">
    <!-- 移动端 Logo -->
    <div
      class="logo text-hidden"
      @click="store.mobileFuncState = !store.mobileFuncState"
    >
      <span v-for="(part, i) in siteParts" :key="i" :class="part.cls">{{
        part.text
      }}</span>
    </div>
    <!-- 功能区 -->
    <Func />
    <!-- 网站链接 -->
    <Link />
    <FriendLinks />
  </div>
</template>

<script setup>
import { mainStore } from '@/store'
import Func from '@/views/Func/index.vue'
import Link from '@/components/Links.vue'
import FriendLinks from '@/components/FriendLinks.vue'
import { siteParts } from '@/utils/site.js'
const store = mainStore()
</script>

<style lang="scss" scoped>
.right {
  // flex: 1 0 0%;
  width: 50%;
  margin-left: 0.75rem;

  .logo {
    width: 100%;
    font-family: 'Pacifico-Regular';
    font-size: 1.75rem;
    position: fixed;
    top: 10%;
    left: 0;
    text-align: center;
    transition: transform 0.3s;
    animation: fade 0.5s;

    &:active {
      transform: scale(0.95);
    }

    @media (min-width: 720px) {
      display: none;
    }
  }

  @media (max-width: 720px) {
    margin-left: 0;
    width: 100%;

    &.hidden {
      display: none;
    }
  }
}
</style>
