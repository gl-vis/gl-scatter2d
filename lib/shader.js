var glslify = require('glslify')

exports.pointVertex       = glslify('./shader/point-vertex.glsl')
exports.pointFragment     = glslify('./shader/point-fragment.glsl')
