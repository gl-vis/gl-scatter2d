var glslify = require('glslify')

exports.vertex = glslify('./shader/vert.glsl')
exports.fragment = glslify('./shader/frag.glsl')
