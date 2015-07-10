precision mediump float;

uniform vec4 color, borderColor;
uniform float centerFraction;



void main() {
  float radius = length(2.0*gl_PointCoord.xy-1.0);
  if(radius > 1.0) {
    discard;
  }
  gl_FragColor = mix(borderColor, color, step(radius, centerFraction));
}
