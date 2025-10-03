precision mediump float;
uniform vec3 uCeilingColor;
uniform vec3 uFloorColor;

varying float vRelativeElevation;



void main() {
    vec3 color = mix(uFloorColor, uCeilingColor, vRelativeElevation);

    gl_FragColor = vec4(color, 1.0);
    
}