uniform vec3 uColorHigh;
uniform vec3 uColorLow;
uniform float uStrength;

varying float vHeight;

void main() {
    float mixStrength = smoothstep(-1.0, 1.0, vHeight/uStrength);
    csm_DiffuseColor.rgb = mix(uColorLow, uColorHigh, mixStrength);
}