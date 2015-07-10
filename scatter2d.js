'use strict'

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var bsearch = require('binary-search-bounds')
var getMarker = require('text-cache')

var pool = require('typedarray-pool')

var SHADERS = require('./lib/shader')
var preprocessPoints = require('./lib/sort-points')

var SUBDIV_COUNT = 2

module.exports = createScatter2D

function Scatter2D(gl, offsetBuffer, shader) {
  this.gl             = gl
  this.offsetBuffer   = offsetBuffer
  this.glyphSize      = 0
  this.shader         = shader
  this.scales         = []
  this.size           = 12.0
  this.borderSize     = 1.0
  this.color          = [1,0,0,1]
  this.borderColor    = [0,0,0,1]
}

var proto = Scatter2D.prototype

proto.update = function(options) {
  options = options || {}

  function dflt(opt, value) {
    if(opt in options) {
      return options[opt]
    }
    return value
  }

  this.size         = dflt('size', 12.0)
  this.color        = dflt('color', [1,0,0,1])
  this.borderSize   = dflt('borderSize', 1)
  this.borderColor  = dflt('borderColor', [0,0,0,1])

  //Update point data
  var data          = options.positions
  this.scales       = preprocessPoints(data, SUBDIV_COUNT)
  this.offsetBuffer.update(data)
}

function compareScale(a, b) {
  return b - a.scale
}

proto.draw = function(camera, scale, pixelRatio) {
  var gl            = this.gl
  var shader        = this.shader
  var scales        = this.scales
  var ext           = this.ext
  var offsetBuffer  = this.offsetBuffer

  var pixelSize   = 0.5 / (gl.drawingBufferWidth * scale)
  var targetScale = pixelSize / SUBDIV_COUNT
  var scaleNum    = Math.min(Math.max(bsearch.le(scales, targetScale, compareScale), 0), scales.length-1)

  shader.bind()
  shader.uniforms.modelViewProjection = camera
  shader.uniforms.color               = this.color
  shader.uniforms.pointSize           = (this.size + this.borderSize)
  shader.uniforms.borderColor         = this.borderColor

  shader.uniforms.screenSize = [gl.drawingBufferWidth, gl.drawingBufferHeight]

  if(this.borderSize === 0) {
    shader.uniforms.centerFraction = 2.0;
  } else {
    shader.uniforms.centerFraction = this.size / (this.size + this.borderSize + 1.25)
  }

  offsetBuffer.bind()
  shader.attributes.position.pointer()

  gl.drawArrays(gl.POINTS, 0, scales[scaleNum].count)
}

function createScatter2D(gl, options) {
  var buffer = createBuffer(gl)
  var shader = createShader(gl, SHADERS.pointVertex, SHADERS.pointFragment)

  var result = new Scatter2D(gl, buffer, shader)
  result.update(options)
  return result
}
