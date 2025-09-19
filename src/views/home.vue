<template>
  <div class="home-container">
    <h1 class="home-title">欢迎来到3D可视化世界</h1>
    <p class="home-subtitle">选择您想要探索的场景</p>

    <div class="navigation-grid">
      <router-link to="/html-galaxy" class="nav-card">
        <div class="card-icon">🌠</div>
        <h3>星系</h3>
        <p>星系效果,轻量级动画展示</p>
      </router-link>

      <router-link to="/html-scroll" class="nav-card">
        <div class="card-icon">📜</div>
        <h3>滚动特效</h3>
        <p>文字滚动动画效果，渐变色彩与流畅过渡</p>
      </router-link>

      <router-link to="/html-model" class="nav-card">
        <div class="card-icon">🖼️</div>
        <h3>3D模型</h3>
        <p>Three.js 实现的3D模型展示</p>
      </router-link>
    </div>

    <div class="footer">
      <p>点击任意卡片开始探索 →</p>
    </div>
  </div>
</template>

<script setup>
// 使用Composition API，但当前页面不需要额外逻辑
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: white;
  padding: 2rem;
}

.home-title {
  font-size: 3.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
}

.home-subtitle {
  font-size: 1.5rem;
  margin-bottom: 3rem;
  color: #a8a8a8;
  text-align: center;
}

.navigation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1000px;
  width: 100%;
  margin-bottom: 3rem;
}

.nav-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  padding: 2rem;
  text-align: center;
  text-decoration: none;
  color: white;
  transition: all 0.3s ease;
  cursor: pointer;
}

.nav-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  background: rgba(255, 255, 255, 0.2);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.nav-card h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #fff;
}

.nav-card p {
  font-size: 1rem;
  color: #b0b0b0;
  line-height: 1.5;
}

.footer {
  margin-top: 2rem;
  text-align: center;
  color: #888;
}

.back-button {
  position: fixed;
  top: 1.5rem;
  left: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50px;
  color: white;
  text-decoration: none;
  font-size: 1rem;
  transition: all 0.3s ease;
  z-index: 1000;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
  .home-title {
    font-size: 2.5rem;
  }

  .home-subtitle {
    font-size: 1.2rem;
  }

  .navigation-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .nav-card {
    padding: 1.5rem;
  }
}
</style>
