precision mediump float;
uniform float uTime;

attribute float aPointSize;

varying vec3 vColor;

void main() {
    vec3 finalPosition = position;

    float distanceToCenter = distance(
        vec3(position.x, position.y, 0.0), vec3(0.0)
    );

    //正切值
    float angle = atan(position.y, position.x);
    angle += uTime*0.5/distanceToCenter;
    finalPosition.x = cos(angle)*distanceToCenter;
    finalPosition.y = sin(angle)*distanceToCenter;


    //粒子位置
    vec4 modelPosition = modelMatrix * vec4(finalPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    //粒子大小
    gl_PointSize = aPointSize;
    
    //距离衰减
    gl_PointSize *= ( 1.0 / - viewPosition.z );

    vColor = color;
}