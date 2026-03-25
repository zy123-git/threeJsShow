attribute vec4 tangent;

#include ../includes/simplexNoise4D.glsl

uniform float uTime;
uniform float uWarpPositionFrequency;
uniform float uWarpTimeFrequency;
uniform float uWarpStrength;
uniform float uPositionFrequency;
uniform float uTimeFrequency;
uniform float uStrength;

varying float vHeight;

float getNoise(vec3 position){
    vec3 warpedPosition = position;
    warpedPosition += simplexNoise4D(vec4(
        warpedPosition * uWarpPositionFrequency, 
        uWarpTimeFrequency * uTime
    )) * uWarpStrength;

    return simplexNoise4D(vec4(
        warpedPosition * uPositionFrequency,
        uTimeFrequency * uTime
    )) * uStrength;
}

void main() {
    float shift = 0.01;

    vec3 positionA = csm_Position + tangent.xyz * shift;
    vec3 positionB = csm_Position + cross(normal, tangent.xyz) * shift;

    positionA += getNoise(positionA) * normal;
    positionB += getNoise(positionB) * normal;

    float height = getNoise(csm_Position);
    csm_Position += height * normal;

    vec3 directionA = csm_Position - positionA;
    vec3 directionB = csm_Position - positionB;

    csm_Normal = cross(directionA, directionB);

    vHeight = height;
}