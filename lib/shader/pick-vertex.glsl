precision highp float;

attribute vec2 positionHi, positionLo;
attribute vec4 pickId;

uniform vec2 scaleHi, scaleLo, translateHi, translateLo;
uniform float pointSize;
uniform vec4 pickOffset;

varying vec4 fragId;

void main() {

 vec2 hgPosition = scaleHi * positionHi + translateHi
                 + scaleLo * positionHi + translateLo
                 + scaleHi * positionLo
                 + scaleLo * positionLo;

  gl_Position  = vec4(hgPosition, 0.0, 1.0);
  gl_PointSize = pointSize;

  vec4 id = pickId + pickOffset;
  id.y += floor(id.x / 256.0);
  id.x -= floor(id.x / 256.0) * 256.0;

  id.z += floor(id.y / 256.0);
  id.y -= floor(id.y / 256.0) * 256.0;

  id.w += floor(id.z / 256.0);
  id.z -= floor(id.z / 256.0) * 256.0;

  fragId = id;
}