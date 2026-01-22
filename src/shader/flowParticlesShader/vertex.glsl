precision mediump float;
attribute vec3 aTargetPosition;
attribute float aParticleSize;

uniform float uSize;
uniform vec2 uResolution;
uniform float uProgress;
uniform vec3 uMixColor1;
uniform vec3 uMixColor2;

varying vec3 vColor;

#include ../includes/simplexNoise3D.glsl

void main() {
    float noiseOrign = simplexNoise3D(position);
    float noiseTarget = simplexNoise3D(aTargetPosition);
    float noise = mix(noiseOrign, noiseTarget, uProgress);
    noise = smoothstep(-1.0,1.0,noise);

    float duration = 0.6;
    float delay = (1.0 - duration) * noise;
    float end = duration + delay;
    float progress = smoothstep(delay, end, uProgress);
    vec3 mixPosition = mix(position,aTargetPosition,progress);

    //粒子位置
    vec4 modelPosition = modelMatrix * vec4(mixPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    //粒子大小
    gl_PointSize = uSize * uResolution.y * aParticleSize;
    
    //距离衰减
    gl_PointSize *= ( 1.0 / - viewPosition.z );

    vColor = mix(uMixColor1, uMixColor2, noise);
}