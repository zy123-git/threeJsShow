uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
attribute vec3 position;

uniform float uTime;

float warpedRadiusSquare = float(1.0);
float xSquare = float(0.0);
vec2 center=vec2(1.0,0.0);

#define PI 3.1415926535897932384626433832795

void main() {
    vec4 transformedPosition =  modelMatrix * vec4(position, 1.0);
    center.x=sin(uTime);
    center.y=cos(uTime);
    xSquare = float((transformedPosition.x-center.x)*(transformedPosition.x-center.x));
    transformedPosition.z=sqrt((warpedRadiusSquare - xSquare))*0.8+center.y;
    gl_Position = projectionMatrix * viewMatrix * transformedPosition;
}
