precision mediump float;

uniform vec2 uResolution;
uniform sampler2D uPictureTexture;

varying vec3 vColor;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;

    gl_Position = projectionPosition;

    float pictureIntensity = texture(uPictureTexture,uv).r;

    //增加粒子大小，并使用较大的系数使粒子更容易可见
    gl_PointSize = 0.25 * uResolution.y * pictureIntensity;
    
    //距离衰减
    gl_PointSize *= ( 1.0 / - viewPosition.z );

    // 传递颜色到片段着色器
    vColor = vec3(pow(pictureIntensity,2.0));
}