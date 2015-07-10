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

function Scatter2D(gl, offsetBuffer, ext, shader) {
  this.gl             = gl
  this.offsetBuffer   = offsetBuffer
  this.glyphBuffer    = glyphBuffer
  this.glyphElements  = glyphElements
  this.glyphSize      = 0
  this.ext            = ext
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

  //If hardware instancing is available, then generate a marker mesh
  // (if not present, markers default to points)
  if(this.ext) {
    var markerFont = options.markerFont || 'sans-serif'
    var marker     = options.marker     || '●'

    var markerMesh  = getMarker(markerFont, marker)
    var markerCells = markerMesh.cells
    var markerVerts = markerMesh.positions

    var markerElements = new Uint16Array(3 * markerCells.length)
    var ptr = 0
    for(var i=0; i<markerCells.length; ++i) {
      var cell = markerCells[i]
      for(var j=0; j<3; ++j) {
        markerElements[ptr++] = cell[j]
      }
    }

    var markerBuffer   = new Float32Array(4 * 2 * markerVerts.length)
    var ptr = 0
    for(var i=0; i<markerVerts.length; ++i) {
      var p = markerVerts[i]
      markerBuffer[ptr++] = p[0]
      markerBuffer[ptr++] = p[1]
      markerBuffer[ptr++] = 0
      markerBuffer[ptr++] = 0
    }

    //Update buffers
    this.glyphBuffer.update(markerBuffer)
    this.glyphElements.update(markerElements)

    //Update glyph count
    this.glyphSize = markerCells.length
  }
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
  shader.uniforms.borderColor         = this.borderColor


  if(ext) {
    shader.uniforms.pointSize   = 2.0 * pixelRatio * this.size / gl.drawingBufferHeight
    shader.uniforms.borderSize  = 2.0 * pixelRatio * this.borderSize / gl.drawingBufferHeight
    shader.uniforms.aspectRatio = gl.drawingBufferHeight / gl.drawingBufferWidth

    this.glyphBuffer.bind()
    shader.attributes.glyphData.pointer()

    offsetBuffer.bind()
    shader.attributes.position.pointer()
    ext.vertexAttribDivisorANGLE(1, this.glyphSize)

    this.glyphElements.bind()
    ext.drawElementsInstancedANGLE(
      gl.TRIANGLES,
      3*this.glyphSize,
      gl.UNSIGNED_SHORT,
      0,
      this.glyphSize*scales[scaleNum].count)
  } else {
    shader.uniforms.pointSize = (this.size + this.borderSize)
    if(this.borderSize === 0) {
      shader.uniforms.centerFraction = 2.0;
    } else {
      shader.uniforms.centerFraction = this.size / (this.size + this.borderSize + 1.25)
    }

    offsetBuffer.bind()
    shader.attributes.position.pointer()

    gl.drawArrays(gl.POINTS, 0, scales[scaleNum].count)
  }
}

function createScatter2D(gl, options) {
  var buffer = createBuffer(gl)
  var instancedExt = gl.getExtension('ANGLE_instanced_arrays')
  var glyphBuffer, glyphElements

  var shader
  if(instancedExt) {
    glyphBuffer = createBuffer(gl)
    glyphElements = createBuffer(gl, void 0, gl.ELEMENT_ARRAY_BUFFER)
    shader = createShader(gl, SHADERS.instancedVertex, SHADERS.instancedFragment)
    shader.attributes.glyphData.location = 0
    shader.attributes.position.location  = 1
  } else {
    shader = createShader(gl, SHADERS.pointVertex, SHADERS.pointFragment)
  }

  var result = new Scatter2D(gl, buffer, glyphBuffer, glyphElements, instancedExt, shader)
  result.update(options)
  return result
}
