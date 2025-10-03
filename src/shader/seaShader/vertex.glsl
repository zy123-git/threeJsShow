precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform float uTime;
uniform float uWaveMainFrequency;
uniform float uAltitude;
uniform float uNoiseAmplitude;
uniform float uIterationCount;

attribute vec3 position;

varying float vRelativeElevation;

#define PI 3.1415926535897932384626433832795

// 简单的伪随机函数，替代hash函数
float random(float x) {
    return fract(sin(x) * 43758.5453123);
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// 替代gradient函数，使用简单的2D梯度 - GLSL ES 1.00完全兼容版本
vec2 gradient(float hash) {
    // 将0-1的随机值映射到8个可能的梯度方向之一
    float h = hash * 8.0;
    int index = int(floor(h));
    float f = fract(h);
    
    // 使用条件判断替代不支持的数组索引
    vec2 g0, g1;
    
    // 计算第一个梯度向量（index % 8）
    if (index == 0) g0 = vec2(1.0, 0.0);
    else if (index == 1) g0 = vec2(1.0, 1.0);
    else if (index == 2) g0 = vec2(0.0, 1.0);
    else if (index == 3) g0 = vec2(-1.0, 1.0);
    else if (index == 4) g0 = vec2(-1.0, 0.0);
    else if (index == 5) g0 = vec2(-1.0, -1.0);
    else if (index == 6) g0 = vec2(0.0, -1.0);
    else g0 = vec2(1.0, -1.0); // index == 7 或其他情况
    
    // 计算第二个梯度向量((index+1) % 8)
    int index1 = index + 1;
    if (index1 == 0) g1 = vec2(1.0, 0.0);
    else if (index1 == 1) g1 = vec2(1.0, 1.0);
    else if (index1 == 2) g1 = vec2(0.0, 1.0);
    else if (index1 == 3) g1 = vec2(-1.0, 1.0);
    else if (index1 == 4) g1 = vec2(-1.0, 0.0);
    else if (index1 == 5) g1 = vec2(-1.0, -1.0);
    else if (index1 == 6) g1 = vec2(0.0, -1.0);
    else if (index1 == 7) g1 = vec2(1.0, -1.0);
    else g1 = vec2(1.0, 0.0); // index1 == 8 时回到第一个方向
    
    return normalize(mix(g0, g1, f));
}

// 柏林噪声核心函数（WebGL 1.0兼容版本）
float perlin_noise(vec2 p) {
    // 1. 确定网格单元坐标和相对位置
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // 2. 计算四个角的伪随机值和梯度
    float ha = random(i);
    float hb = random(i + vec2(1.0, 0.0));
    float hc = random(i + vec2(0.0, 1.0));
    float hd = random(i + vec2(1.0, 1.0));
    
    vec2 g0 = gradient(ha);
    vec2 g1 = gradient(hb);
    vec2 g2 = gradient(hc);
    vec2 g3 = gradient(hd);
    
    // 3. 计算距离向量并点积梯度
    float d0 = dot(g0, f - vec2(0.0));
    float d1 = dot(g1, f - vec2(1.0, 0.0));
    float d2 = dot(g2, f - vec2(0.0, 1.0));
    float d3 = dot(g3, f - vec2(1.0, 1.0));
    
    // 4. 平滑插值（使用五次多项式替代smoothstep）
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // 5. 双线性插值
    float ix0 = mix(d0, d1, u.x);
    float ix1 = mix(d2, d3, u.x);
    return mix(ix0, ix1, u.y);
}

void main() {
    vec4 transformedPosition =  modelMatrix * vec4(position, 1.0);
    transformedPosition.z+=(sin(transformedPosition.x*4.0+uTime*uWaveMainFrequency)+
        sin(transformedPosition.y*3.0+uTime*uWaveMainFrequency))*uAltitude*0.5+uAltitude;
    
    for (float i = 0.0; i < 3.0; i += 1.0) {
        transformedPosition.z-=abs(
            perlin_noise(
                vec2(
                    transformedPosition.x*(10.0-i)+uTime,
                    transformedPosition.y*(10.0-i)+uTime
                )
            )*
            uNoiseAmplitude/pow(2.0, i)
        );
    }

    gl_Position = projectionMatrix * viewMatrix * transformedPosition;

    vRelativeElevation = transformedPosition.z / uAltitude;
}
