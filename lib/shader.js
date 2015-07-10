var glslify = require('glslify')

exports.pointVertex       = glslify('./shader/point-vertex.glsl')
exports.pointFragment     = glslify('./shader/point-fragment.glsl')
exports.instancedVertex   = glslify('./shader/instanced-vertex.glsl')
exports.instancedFragment = glslify('./shader/instanced-fragment.glsl')
