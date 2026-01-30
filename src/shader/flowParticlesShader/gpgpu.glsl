#include ../includes/simplexNoise4D.glsl

uniform float uTime;
uniform sampler2D uBase;
uniform float uDeltaTime;
uniform float uFlowFeildInfluence;
uniform float uFlowStrength;

void main(){
    float time = uTime * 0.2;
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles,uv);
    vec4 base = texture(uBase, uv);
    

    if(particle.a >= 1.0){
        particle.a = mod(particle.a, 1.0);
        particle.xyz = base.xyz;
    }

    else{
        float strength = simplexNoise4D(vec4(base.xyz * 0.2, time * 1.0));
        float flowFieldInfluence = (0.5 - uFlowFeildInfluence) * 2.0;
        strength = smoothstep(flowFieldInfluence, 1.0, strength);



        vec3 flowField = vec3(
            simplexNoise4D(vec4(particle.xyz + 0.0, time)),
            simplexNoise4D(vec4(particle.xyz + 1.0, time)),
            simplexNoise4D(vec4(particle.xyz + 2.0, time))
        );
        flowField = normalize(flowField);
        particle.xyz += flowField * uDeltaTime * strength * uFlowStrength;

        //粒子循环（生命）周期
        particle.a += uDeltaTime * 0.2;
    }

    

    gl_FragColor = particle;
}