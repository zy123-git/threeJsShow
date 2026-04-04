precision mediump float;

uniform vec2 uResolution;
uniform sampler2D uPictureTexture;
uniform sampler2D uDisplacementTexture;

attribute float aIntensity;
attribute float aAngle;

varying vec4 vColor;

void main() {
    vec3 newPosition = position;
    float displacementIntensity = texture(uDisplacementTexture, uv).r;
    //使用函数映射实现：轨迹纹理若灰度小于0.1则视为0，淡化函数使用的黑色矩形的alpha=0.1
    displacementIntensity = smoothstep(0.1, 0.2, displacementIntensity);

    //轨迹纹理影响粒子偏移
    vec3 displacement = vec3(
        cos(aAngle) * 0.2,
        sin(aAngle) * 0.2,
        1.0
    );
    displacement = normalize(displacement);
    displacement *= displacementIntensity;
    displacement *= 3.0;
    displacement *= aIntensity;

    newPosition += displacement;

    vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;

    gl_Position = projectionPosition;

    float r = texture(uPictureTexture,uv).r;
    float g = texture(uPictureTexture,uv).g;
    float b = texture(uPictureTexture,uv).b;
    float pictureIntensity = 0.299 * r + 0.587 * g + 0.114 * b;
    pictureIntensity = smoothstep(0.0, 1.0, pictureIntensity);
    pictureIntensity = pow(pictureIntensity, 1.5);

    //增加粒子大小，并使用较大的系数使粒子更容易可见
    gl_PointSize = 0.4 * uResolution.y * (1.0 - pictureIntensity);
    
    //距离衰减
    gl_PointSize *= ( 1.0 / - viewPosition.z );

    // 传递颜色到片段着色器
    vColor = vec4(texture(uPictureTexture,uv).rgb, pictureIntensity);
}