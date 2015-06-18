'use strict'

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var createVAO = require('gl-vao')
var bsearch = require('binary-search-bounds')

var pool = require('typedarray-pool')

var SHADERS = require('./lib/shader')
var preprocessPoints = require('./lib/sort-points')

var SUBDIV_COUNT = 8

module.exports = createScatter2D

function Scatter2D(gl, vao, buffer, shader) {
  this.gl = gl
  this.vao = vao
  this.buffer = buffer
  this.shader = shader
  this.scales = []
}

var proto = Scatter2D.prototype

proto.update = function(options) {
  options = options || {}

  this.pointSize = options.pointSize || 2
  var data = options.positions
  this.scales = preprocessPoints(data, SUBDIV_COUNT)
  this.buffer.update(data)
}

function compareScale(a, b) {
  return b - a.scale
}

proto.draw = function(camera, scale) {
  var shader = this.shader
  var gl = this.gl
  var vao = this.vao
  var scales = this.scales

  var pixelSize = 0.5 / (gl.drawingBufferWidth * scale)
  var targetScale = pixelSize / 16.0
  var scaleNum = Math.max(bsearch.le(scales, targetScale, compareScale), 0)

  vao.bind()
  shader.bind()
  shader.uniforms.modelViewProjection = camera
  shader.uniforms.pointSize = this.pointSize
  shader.uniforms.color = [1, 0, 0, 1]
  gl.drawArrays(gl.POINTS, 0, scales[scaleNum].count)
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
