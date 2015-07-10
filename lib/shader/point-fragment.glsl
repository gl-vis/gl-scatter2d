precision mediump float;

uniform vec4 color, borderColor;
uniform float centerFraction;

float smoothStep(float x, float y) {
  return 1.0 / (1.0 + exp(50.0*(x - y)));
}

void main() {
  float radius = length(2.0*gl_PointCoord.xy-1.0);
  if(radius > 1.0) {
    discard;
  }
  gl_FragColor = mix(borderColor, color, smoothStep(radius, centerFraction));
}
