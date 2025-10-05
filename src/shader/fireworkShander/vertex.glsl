precision mediump float;

uniform float uProgress;

attribute float aSize;
attribute float aTimeMutiplier;

float remap(float value, float min1, float max1, float min2, float max2) {
  return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
}

void main() {
  //因为progress变化到1.0所需时间缩短，从而将整个周期缩短了
  float progress = uProgress * aTimeMutiplier;

  vec3 newPosition = position;
  
  //分段处理粒子动画
  //爆炸
  float explosionProgress = remap(progress, 0.0, 0.25, 0.0, 0.9);
  explosionProgress = clamp(explosionProgress, 0.0, 1.0);
  explosionProgress =1.0 - pow(1.0 - explosionProgress, 3.0);
  newPosition *= (explosionProgress+0.1);
  //下落
  float fallingProgress = remap(progress, 0.2, 1.0, 0.0, 1.0);
  fallingProgress = clamp(fallingProgress, 0.0, 1.0);
  fallingProgress =1.0 - pow(1.0 - fallingProgress, 3.0);
  newPosition.y -= fallingProgress * 0.2;
  //放大缩小
  float scaleOpeningProgress = remap(progress, 0.0, 0.125, 0.0, 1.0);
  float scaleClosingProgress = remap(progress, 0.125, 1.0, 1.0, 0.0);
  float scaleProgress = min(scaleOpeningProgress, scaleClosingProgress);
  scaleProgress = clamp(scaleProgress, 0.0, 1.0);
  //闪烁
  float twinkProgress = remap(progress, 0.2, 0.8, 0.0, 1.0);
  twinkProgress = clamp(twinkProgress, 0.0, 1.0);
  float sizeTwinkProgress =sin(twinkProgress * 30.0) * 0.5 + 0.5;
  sizeTwinkProgress = 1.0 - sizeTwinkProgress * twinkProgress;

  vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectionPosition = projectionMatrix * viewPosition;


  gl_Position = projectionPosition;
  
  gl_PointSize = aSize * scaleProgress * sizeTwinkProgress;

  gl_PointSize *= ( 1.0 / - viewPosition.z );

  if(gl_PointSize < 1.0)
    gl_Position = vec4(999.0);
}