attribute vec2 position;

uniform mat3 modelViewProjection;
uniform float pointSize;

void main() {
  vec3 hgPosition = modelViewProjection * vec3(position, 1);
  gl_Position = vec4(hgPosition.xy, 0, hgPosition.z);
  gl_PointSize = pointSize;
}
