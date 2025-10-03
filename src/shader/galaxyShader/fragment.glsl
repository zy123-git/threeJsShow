precision mediump float;

uniform vec3 uColorInside;
uniform vec3 uColorOutside;

varying vec3 vColor;

void main() {
    //gl_PointCoord 是一个在 0.0 到 1.0 范围内的二维向量，
    //表示当前片段在点中的归一化坐标。
    //它的 x 分量对应于片段在点中的水平位置，
    //而 y 分量对应于垂直位置。

    //制造出圆形
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 5.0);

    //最终颜色，通过距离来混合颜色，距中心点越远，颜色越淡
    float brightnessFactor = 3.5;
    vec3 finalColor=mix(vec3(0.0), vColor, strength*brightnessFactor);
    
    gl_FragColor = vec4(finalColor, 1.0);
}