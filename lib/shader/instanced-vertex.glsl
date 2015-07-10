precision mediump float;

attribute vec2 position;
attribute vec4 glyphData;

uniform mat3 modelViewProjection;
uniform float pointSize, borderSize, aspectRatio;
uniform vec4 color, borderColor;

varying vec4 fragColor;

void main() {
  vec2 glyph        = glyphData.xy;
  vec2 borderNormal = glyphData.zw;
  
  vec3 hgPosition   = modelViewProjection * vec3(position, 1);
  hgPosition.xy += hgPosition.z * vec2(aspectRatio, 1.0) *
    (pointSize * glyph + borderSize * borderNormal);

  gl_Position  = vec4(hgPosition.xy, 0, hgPosition.z);
  fragColor = mix(borderColor, color, step(length(borderNormal), 0.5));
}
