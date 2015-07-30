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

function Scatter2D(plot, offsetBuffer, pickBuffer, shader, pickShader) {
  this.plot           = plot
  this.offsetBuffer   = offsetBuffer
  this.pickBuffer     = pickBuffer
  this.shader         = shader
  this.pickShader     = pickShader
  this.scales         = []
  this.size           = 12.0
  this.borderSize     = 1.0
  this.pointCount     = 0
  this.color          = [1,0,0,1]
  this.borderColor    = [0,0,0,1]
  this.bounds         = [Infinity,Infinity,-Infinity,-Infinity]
  this.pickOffset     = 0
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
  this.color        = dflt('color', [1,0,0,1]).slice()
  this.borderSize   = dflt('borderSize', 1)
  this.borderColor  = dflt('borderColor', [0,0,0,1]).slice()

  //Update point data
  var data          = options.positions
  var packed        = pool.mallocFloat32(data.length)
  var packedId      = pool.mallocInt32(data.length)
  this.scales       = preprocessPoints(data, SUBDIV_COUNT, packed, packedId, this.bounds)
  this.offsetBuffer.update(packed)
  this.pickBuffer.update(packedId)
  pool.free(packed)

  this.pointCount = data.length >>> 1
  this.pickOffset = 0
}

function compareScale(a, b) {
  return b - a.scale
}

proto.drawPick = (function() {
  var MATRIX = [1,0,0,
                0,1,0,
                0,0,1]
  var PICK_VEC4 = [0,0,0,0]
return function(pickOffset) {
  var plot          = this.plot
  var shader        = this.pickShader
  var scales        = this.scales
  var offsetBuffer  = this.offsetBuffer
  var pickBuffer    = this.pickBuffer
  var bounds        = this.bounds
  var size          = this.size
  var borderSize    = this.borderSize
  var gl            = plot.gl
  var pixelRatio    = plot.pickPixelRatio
  var viewBox       = plot.viewBox
  var dataBox       = plot.dataBox

  var boundX  = bounds[2] - bounds[0]
  var boundY  = bounds[3] - bounds[1]
  var dataX   = dataBox[2] - dataBox[0]
  var dataY   = dataBox[3] - dataBox[1]
  var screenX = (viewBox[2] - viewBox[0]) * pixelRatio / plot.pixelRatio
  var screenY = (viewBox[3] - viewBox[1]) * pixelRatio / plot.pixelRatio

  var pixelSize   = Math.max(dataX / screenX, dataY / screenY)
  var targetScale = pixelSize
  var scaleNum    = Math.min(Math.max(bsearch.le(scales, targetScale, compareScale), 0), scales.length-1)

  MATRIX[0] = 2.0 * boundX / dataX
  MATRIX[4] = 2.0 * boundY / dataY
  MATRIX[6] = 2.0 * (bounds[0] - dataBox[0]) / dataX - 1.0
  MATRIX[7] = 2.0 * (bounds[1] - dataBox[1]) / dataY - 1.0

  this.pickOffset = pickOffset
  PICK_VEC4[0] = ( pickOffset      & 0xff)
  PICK_VEC4[1] = ((pickOffset>>8)  & 0xff)
  PICK_VEC4[1] = ((pickOffset>>16) & 0xff)
  PICK_VEC4[1] = ((pickOffset>>24) & 0xff)

  shader.bind()
  shader.uniforms.matrix      = MATRIX
  shader.uniforms.color       = this.color
  shader.uniforms.borderColor = this.borderColor
  shader.uniforms.pointSize   = pixelRatio * (size + borderSize)
  shader.uniforms.pickOffset  = PICK_VEC4

  if(this.borderSize === 0) {
    shader.uniforms.centerFraction = 2.0;
  } else {
    shader.uniforms.centerFraction = size / (size + borderSize + 1.25)
  }

  offsetBuffer.bind()
  shader.attributes.position.pointer()
  pickBuffer.bind()
  shader.attributes.pickId.pointer(gl.UNSIGNED_BYTE)

  var offset     = scales[scaleNum].count
  var pointCount = this.pointCount
  gl.drawArrays(gl.POINTS, offset, pointCount - offset)

  return pickOffset + pointCount
}
})()

proto.draw = (function() {
  var MATRIX = [1, 0, 0,
                0, 1, 0,
                0, 0, 1]

  return function() {
    var plot          = this.plot
    var shader        = this.shader
    var scales        = this.scales
    var offsetBuffer  = this.offsetBuffer
    var bounds        = this.bounds
    var size          = this.size
    var borderSize    = this.borderSize
    var gl            = plot.gl
    var pixelRatio    = plot.pixelRatio
    var viewBox       = plot.viewBox
    var dataBox       = plot.dataBox

    var boundX  = bounds[2] - bounds[0]
    var boundY  = bounds[3] - bounds[1]
    var dataX   = dataBox[2] - dataBox[0]
    var dataY   = dataBox[3] - dataBox[1]
    var screenX = viewBox[2] - viewBox[0]
    var screenY = viewBox[3] - viewBox[1]

    var pixelSize   = Math.max(dataX / screenX, dataY / screenY)
    var targetScale = pixelSize
    var scaleNum    = Math.min(Math.max(bsearch.le(scales, targetScale, compareScale), 0), scales.length-1)

    MATRIX[0] = 2.0 * boundX / dataX
    MATRIX[4] = 2.0 * boundY / dataY
    MATRIX[6] = 2.0 * (bounds[0] - dataBox[0]) / dataX - 1.0
    MATRIX[7] = 2.0 * (bounds[1] - dataBox[1]) / dataY - 1.0

    shader.bind()
    shader.uniforms.matrix      = MATRIX
    shader.uniforms.color       = this.color
    shader.uniforms.borderColor = this.borderColor
    shader.uniforms.pointSize   = pixelRatio * (size + borderSize)

    if(this.borderSize === 0) {
      shader.uniforms.centerFraction = 2.0;
    } else {
      shader.uniforms.centerFraction = size / (size + borderSize + 1.25)
    }

    offsetBuffer.bind()
    shader.attributes.position.pointer()
    var offset     = scales[scaleNum].count
    var pointCount = this.pointCount
    gl.drawArrays(gl.POINTS, offset, pointCount - offset)
  }
})()

proto.pick = function(x, y, value) {
  var pickOffset = this.pickOffset
  var pointCount = this.pointCount
  if(value < pickOffset || value >= pickOffset + pointCount) {
    return null
  }
  return {
    object:  this,
    pointId: value - pickOffset
  }
}

function createScatter2D(plot, options) {
  var gl     = plot.gl
  var buffer = createBuffer(gl)
  var pickBuffer = createBuffer(gl)
  var shader = createShader(gl, SHADERS.pointVertex, SHADERS.pointFragment)
  var pickShader = createShader(gl, SHADERS.pickVertex, SHADERS.pickFragment)

  var result = new Scatter2D(plot, buffer, pickBuffer, shader, pickShader)
  result.update(options)
  return result
}
