precision highp float;

attribute vec2 positionHi, positionLo;
attribute float weight;

uniform vec2 scaleHi, scaleLo, translateHi, translateLo;
uniform float pointSize, useWeight;

varying float fragWeight;

void main() {

 vec2 hgPosition = scaleHi * positionHi + translateHi
                 + scaleLo * positionHi + translateLo
                 + scaleHi * positionLo
                 + scaleLo * positionLo;

  gl_Position  = vec4(hgPosition, 0.0, 1.0);
  gl_PointSize = pointSize;
  fragWeight = mix(1.0, weight, useWeight);
}