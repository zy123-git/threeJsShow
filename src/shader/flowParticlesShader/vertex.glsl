attribute vec2 aParticleUv;
attribute vec4 aColor;
attribute float aParticleSize;

uniform float uSize;
uniform vec2 uResolution;
uniform sampler2D uParticlesTexture;


varying vec3 vColor;

void main() {
    vec4 particle = texture(uParticlesTexture, aParticleUv);

    //粒子位置
    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    //粒子生命周期大小变化
    float sizeIn = smoothstep(0.0, 0.1, particle.a);
    float sizeOut = smoothstep(1.0, 0.7, particle.a);
    float size = min(sizeIn,sizeOut);

    gl_Position = projectedPosition;

    //粒子大小
    gl_PointSize = uSize * uResolution.y * aParticleSize * size;
    
    //距离衰减
    gl_PointSize *= ( 1.0 / - viewPosition.z );

    vColor = aColor.xyz;
}
