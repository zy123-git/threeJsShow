precision mediump float;

uniform sampler2D uPictureTexture;

varying vec3 vColor;

void main() {
    vec2 uv = gl_PointCoord;
    float distanceToCenter = length(uv - vec2(0.5));
    if(distanceToCenter > 0.5)
        discard;

    // 使用从顶点着色器传递过来的颜色
    gl_FragColor = vec4(vColor, 1.0);
}