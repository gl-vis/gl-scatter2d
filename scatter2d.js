'use strict'

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var createVAO = require('gl-vao')

var pool = require('typedarray-pool')

var SHADERS = require('./lib/shader')

module.exports = createScatter2D

function Scatter2D(gl, vao, buffer, shader) {
  this.gl = gl
  this.vao = vao
  this.buffer = buffer
  this.shader = shader
  this.primCount = 0
}

var proto = Scatter2D.prototype

proto.update = function(options) {
  options = options || {}
  var positions = options.positions || []
  var numPoints = positions.length
  var data = pool.mallocFloat32(2 * numPoints)
  for(var i=0; i<numPoints; ++i) {
    var p = positions[i]
    data[2*i] = p[0]
    data[2*i+1] = p[1]
  }
  this.buffer.update(data)
  pool.free(data)
  this.primCount = numPoints
}

proto.draw = function(camera) {
  var shader = this.shader
  var gl = this.gl
  var vao = this.vao

  vao.bind()
  shader.bind()
  shader.uniforms.modelViewProjection = camera
  gl.drawArrays(gl.POINTS, 0, this.primCount)
  vao.unbind()
}

function createScatter2D(gl, options) {
  var buffer = createBuffer(gl)
  var vao = createVAO(gl, [{
      type: gl.FLOAT,
      offset: 0,
      stride: 0,
      size: 2,
      buffer: buffer
    }])
  var shader = createShader(gl, SHADERS.vertex, SHADERS.fragment)

  var result = new Scatter2D(gl, vao, buffer, shader)
  result.update(options)
  return result
}
