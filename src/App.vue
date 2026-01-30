<template>
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
  <router-view />
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

nav {
  padding: 1rem;
  background-color: #1a1a1a;
  text-align: center;
  z-index: 10;
}

nav a {
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
  z-index: 10;
}

nav a:hover {
  background-color: #333;
}

nav a.router-link-active {
  background-color: #007bff;
}
</style>
