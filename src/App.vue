<template>
  <nav>
    <router-link to="/">首页</router-link>
    <router-link to="/html-galaxy">星系</router-link>
    <router-link to="/html-scroll">滚动特效</router-link>
    <router-link to="/html-model">3D模型</router-link>
    <router-link to="/html-book">书页</router-link>
    <router-link to="/html-sea">海洋</router-link>
  </nav>
  <router-view />
</template>

<script setup></script>

<style>
nav {
  padding: 1rem;
  background-color: #1a1a1a;
  text-align: center;
}

nav a {
  color: #fff;
  text-decoration: none;
  margin: 0 1rem;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

nav a:hover {
  background-color: #333;
}

nav a.router-link-active {
  background-color: #007bff;
}
</style>
