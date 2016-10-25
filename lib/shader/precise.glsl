#pragma glslify: export(pfx)
vec4 pfx(vec2 scaleHi, vec2 scaleLo, vec2 translateHi, vec2 translateLo, vec2 positionHi, vec2 positionLo) {
  return vec4(scaleHi * positionHi + translateHi
            + scaleLo * positionHi + translateLo
            + scaleHi * positionLo
            + scaleLo * positionLo, 0.0, 1.0);
}