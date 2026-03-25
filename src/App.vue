<template>
  <div class="app-container">
    <nav>
      <router-link to="/">首页</router-link>
      <router-link to="/html-galaxy">星系</router-link>
      <router-link to="/html-scroll">滚动特效</router-link>
      <router-link to="/html-model">3D模型</router-link>
      <router-link to="/html-wobbly-sphere">可变形球体</router-link>
      <router-link to="/html-sea">海洋</router-link>
      <router-link to="/html-forest">森林</router-link>
      <router-link to="/html-fireworks">烟花</router-link>
      <router-link to="/html-classroom">教室</router-link>
      <router-link to="/html-particles">粒子</router-link>
      <router-link to="/html-morph-particles">变形粒子</router-link>
      <router-link to="/html-flow-particles">流动粒子</router-link>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup></script>

<style>
/* 全局样式重置 - 确保body和html不产生滚动条 */
body,
html {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

nav {
  width: 200px;
  padding: 1rem;
  background-color: rgb(15, 218, 228);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 10;
  overflow-y: auto;
}

nav a {
  text-decoration: none;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
  z-index: 10;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

nav a:hover {
  background-color: #333;
}

nav a.router-link-active {
  background-color: #007bff;
}

main {
  flex: 1;
  height: 100%;
  overflow-y: auto; /* 允许垂直滚动 */
  overflow-x: hidden; /* 禁止横向滚动 */
}
</style>
