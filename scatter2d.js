'use strict'

var createShader = require('gl-shader')
var createBuffer = require('gl-buffer')
var search = require('binary-search-bounds')
var snapPoints = require('snap-points-2d')
var pool = require('typedarray-pool')
var SHADERS = require('./lib/shader')
var normalize = require('array-normalize')
var getBounds = require('array-bounds')

module.exports = createScatter2D

function Scatter2D(plot, positionBufferHi, positionBufferLo, pickBuffer, weightBuffer, shader, pickShader) {
  this.plot             = plot
  this.positionBufferHi = positionBufferHi
  this.positionBufferLo = positionBufferLo
  this.pickBuffer       = pickBuffer
  this.weightBuffer     = weightBuffer
  this.shader           = shader
  this.pickShader       = pickShader
  this.scales           = []
  this.size             = 12.0
  this.borderSize       = 1.0
  this.pointCount       = 0
  this.color            = [1, 0, 0, 1]
  this.borderColor      = [0, 0, 0, 1]
  this.bounds           = [Infinity, Infinity, -Infinity, -Infinity]
  this.pickOffset       = 0
  this.points           = null
  this.xCoords          = null
  this.snapPoints       = true
}

var proto = Scatter2D.prototype
var scaleHi = new Float32Array(2)
var scaleLo = new Float32Array(2)
var translateHi = new Float32Array(2)
var translateLo = new Float32Array(2)
var PICK_VEC4 = [0, 0, 0, 0]

proto.dispose = function() {
  this.shader.dispose()
  this.pickShader.dispose()
  this.positionBufferHi.dispose()
  this.positionBufferLo.dispose()
  this.pickBuffer.dispose()
  if(this.xCoords) pool.free(this.xCoords)
  this.plot.removeObject(this)
}

proto.update = function(options) {
  options = options || {}

  function dflt(opt, value) {
    return opt in options ? options[opt] : value
  }

  this.size         = dflt('size', 12)
  this.color        = dflt('color', [1, 0, 0, 1]).slice()
  this.borderSize   = dflt('borderSize', 1)
  this.borderColor  = dflt('borderColor', [0, 0, 0, 1]).slice()
  this.snapPoints   = dflt('snapPoints', true)

  //do not recalc points if there is no positions
  if (options.positions != null) {
    if(this.xCoords) pool.free(this.xCoords)

    this.points             = options.positions
    var pointCount          = this.points.length >>> 1

    var packedId = pool.mallocInt32(pointCount)
    var packedW = pool.mallocFloat32(pointCount)
    var packed = pool.mallocFloat64(2 * pointCount)
    packed.set(this.points)

    if (this.snapPoints) {
      this.scales = snapPoints(packed, packedId, packedW, this.bounds)
    }
    else {
      //get bounds
      this.bounds = getBounds(packed, 2)

      // rescale packed to unit box
      normalize(packed, 2, this.bounds)

      // generate fake ids
      for (var i = 0; i < pointCount; i++) {
        packedId[i] = i
        packedW[i] = 1
      }
    }

    var xCoords             = pool.mallocFloat64(pointCount)
    var packedHi            = pool.mallocFloat32(2 * pointCount)
    var packedLo            = pool.mallocFloat32(2 * pointCount)
    packedHi.set(packed)
    for(var i = 0, j = 0; i < pointCount; i++, j += 2) {
      packedLo[j] = packed[j] - packedHi[j]
      packedLo[j + 1] = packed[j + 1] - packedHi[j + 1]
      xCoords[i] = packed[j]
    }
    this.positionBufferHi.update(packedHi)
    this.positionBufferLo.update(packedLo)
    this.pickBuffer.update(packedId)
    this.weightBuffer.update(packedW)

    pool.free(packedHi)
    pool.free(packedLo)
    pool.free(packedW)
    pool.free(packed)
    pool.free(packedId)

    this.xCoords = xCoords
    this.pointCount = pointCount
    this.pickOffset = 0
  }
}

proto.draw = function(pickOffset) {
  var pick = pickOffset !== void(0)

  var plot             = this.plot
  var shader           = pick ? this.pickShader : this.shader
  var scales           = this.scales
  var positionBufferHi = this.positionBufferHi
  var positionBufferLo = this.positionBufferLo
  var pickBuffer       = this.pickBuffer
  var bounds           = this.bounds
  var size             = this.size
  var borderSize       = this.borderSize
  var gl               = plot.gl
  var pixelRatio       = pick ? plot.pickPixelRatio : plot.pixelRatio
  var viewBox          = plot.viewBox
  var dataBox          = plot.dataBox

  if(this.pointCount === 0)
    return pickOffset

  var boundX  = bounds[2] - bounds[0]
  var boundY  = bounds[3] - bounds[1]
  var dataX   = dataBox[2] - dataBox[0]
  var dataY   = dataBox[3] - dataBox[1]
  var screenX = (viewBox[2] - viewBox[0]) * pixelRatio / plot.pixelRatio
  var screenY = (viewBox[3] - viewBox[1]) * pixelRatio / plot.pixelRatio

  var pixelSize = this.pixelSize = Math.min(dataX / screenX, dataY / screenY)

  var scaleX = 2 * boundX / dataX
  var scaleY = 2 * boundY / dataY

  scaleHi[0] = scaleX
  scaleHi[1] = scaleY

  scaleLo[0] = scaleX - scaleHi[0]
  scaleLo[1] = scaleY - scaleHi[1]

  var translateX = (bounds[0] - dataBox[0] - 0.5 * dataX) / boundX
  var translateY = (bounds[1] - dataBox[1] - 0.5 * dataY) / boundY

  translateHi[0] = translateX
  translateHi[1] = translateY

  translateLo[0] = translateX - translateHi[0]
  translateLo[1] = translateY - translateHi[1]

  shader.bind()
  shader.uniforms.scaleHi     = scaleHi
  shader.uniforms.scaleLo     = scaleLo
  shader.uniforms.translateHi = translateHi
  shader.uniforms.translateLo = translateLo
  shader.uniforms.color       = this.color
  shader.uniforms.borderColor = this.borderColor
  shader.uniforms.pointSize   = pixelRatio * (size + borderSize)
  shader.uniforms.centerFraction = this.borderSize === 0 ? 2 : size / (size + borderSize + 1.25)

  positionBufferHi.bind()
  shader.attributes.positionHi.pointer()

  positionBufferLo.bind()
  shader.attributes.positionLo.pointer()

  if(pick) {
    this.pickOffset = pickOffset
    PICK_VEC4[0] = ( pickOffset        & 0xff)
    PICK_VEC4[1] = ((pickOffset >> 8)  & 0xff)
    PICK_VEC4[2] = ((pickOffset >> 16) & 0xff)
    PICK_VEC4[3] = ((pickOffset >> 24) & 0xff)
    shader.uniforms.pickOffset = PICK_VEC4

    pickBuffer.bind()
    shader.attributes.pickId.pointer(gl.UNSIGNED_BYTE)

  } else {

    shader.uniforms.useWeight = 1
    this.weightBuffer.bind()
    shader.attributes.weight.pointer()

  }


  var firstLevel = true

  if (this.snapPoints) {
    for(var scaleNum = scales.length - 1; scaleNum >= 0; scaleNum--) {
      var lod = scales[scaleNum]
      if(lod.pixelSize < pixelSize && scaleNum > 1)
        continue

      var range = this.getVisibleRange(lod)
      var startOffset = range[0], endOffset = range[1]

      if(endOffset > startOffset)
        gl.drawArrays(gl.POINTS, startOffset, endOffset - startOffset)

      if(!pick && firstLevel) {
        firstLevel = false
        shader.uniforms.useWeight = 0
      }
    }
  }
  else {
    gl.drawArrays(gl.POINTS, 0, this.pointCount)
  }

  return pickOffset + this.pointCount
}

proto.getVisibleRange = function (lod) {
  var dataBox = this.plot.dataBox,
      bounds = this.bounds,
      pixelSize = this.pixelSize,
      size = this.size,
      pixelRatio = this.plot.pixelRatio,
      boundX  = bounds[2] - bounds[0],
      boundY  = bounds[3] - bounds[1]

  if (!lod) {
    for(var scaleNum = this.scales.length - 1, lod; scaleNum >= 0; scaleNum--) {
      lod = this.scales[scaleNum];
      if(!(lod.pixelSize < pixelSize && scaleNum > 1)) break;
    }
  }

  var xCoords = this.xCoords
  var xStart = (dataBox[0] - bounds[0] - pixelSize * size * pixelRatio) / boundX
  var xEnd   = (dataBox[2] - bounds[0] + pixelSize * size * pixelRatio) / boundX

  var intervalStart = lod.offset
  var intervalEnd   = lod.count + intervalStart

  var startOffset = search.ge(xCoords, xStart, intervalStart, intervalEnd - 1)
  var endOffset   = search.lt(xCoords, xEnd, startOffset, intervalEnd - 1) + 1

  return [startOffset, endOffset]
}

proto.drawPick = proto.draw

proto.pick = function(x, y, value) {
  var pointId = value - this.pickOffset
  return pointId < 0 || pointId >= this.pointCount
    ? null : {
    object:  this,
    pointId: pointId,
    dataCoord: [ this.points[2 * pointId], this.points[2 * pointId + 1] ]
  }
}

function createScatter2D(plot, options) {
  var gl = plot.gl
  var positionBufferHi = createBuffer(gl)
  var positionBufferLo = createBuffer(gl)
  var pickBuffer = createBuffer(gl)
  var weightBuffer = createBuffer(gl)
  var shader = createShader(gl, SHADERS.pointVertex, SHADERS.pointFragment)
  var pickShader = createShader(gl, SHADERS.pickVertex, SHADERS.pickFragment)

  var result = new Scatter2D(plot, positionBufferHi, positionBufferLo, pickBuffer, weightBuffer, shader, pickShader)
  result.update(options)

  plot.addObject(result) // register with plot

  return result
}
