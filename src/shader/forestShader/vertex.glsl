precision mediump float;

uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform float uTime;
uniform float uWaveMainFrequency;
uniform float uAltitude;
uniform float uNoiseAmplitude;
uniform float uIterationCount;
uniform sampler2D uNoiseTexture;

attribute vec3 position;

varying float vRelativeElevation;

#define PI 3.1415926535897932384626433832795

// 柏林噪声核心函数（WebGL 1.0兼容版本）
float perlin_noise(vec2 p) {
    return texture2D(uNoiseTexture, p * 0.01).r;
}

float hill(float position){
    return 1.0-pow(position, 4.0);
}

void main() {
    vec4 transformedPosition =  modelMatrix * vec4(position, 1.0);

    float altitude=uAltitude+sin(uTime*0.2)*0.1+0.1;
    
    transformedPosition.z+=abs(sin(transformedPosition.x*3.4)+sin(transformedPosition.y*2.6));
    transformedPosition.z+=abs(cos(transformedPosition.x*2.3)+sin(transformedPosition.y*3.6));

    transformedPosition.z+=abs(sin(transformedPosition.x+uTime*0.5))*0.3;

    transformedPosition.z*=0.35;   
    
   // 第一层噪声
    transformedPosition.z-=abs(
        perlin_noise(vec2(transformedPosition.x*10.0+uTime, transformedPosition.y*10.0+uTime)) * 
        uNoiseAmplitude
    );
    
    // 第二层噪声
    transformedPosition.z-=abs(
        perlin_noise(vec2(transformedPosition.x*9.0+uTime, transformedPosition.y*9.0+uTime)) * 
        uNoiseAmplitude * 0.5
    );
    

    gl_Position = projectionMatrix * viewMatrix * transformedPosition;

    vRelativeElevation = transformedPosition.z / altitude;
}
