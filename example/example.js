var fit = require('canvas-fit')
var gaussRandom = require('gauss-random')
var mouseWheel = require('mouse-wheel')
var mouseChange = require('mouse-change')
var createPoints = require('../scatter2d')

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas), false)

var gl = canvas.getContext('webgl')

var POINT_COUNT = 1e7
var POINT_SIZE = 2

var points
var angle = 0.0
var scale = 0.0
var tx = 0.0
var ty = 0.0

function getMatrix() {
  var s = Math.exp(scale)
  var cx = Math.cos(angle)
  var cy = Math.sin(angle)
  var h = canvas.width / canvas.height
  return [ s*cx, h*s*cy, 0,
          -s*cy, h*s*cx, 0,
          tx, h*ty, 1]
}

var lastX = 0
var lastY = 0

mouseWheel(function(dx, dy) {

  var s = Math.exp(scale)
  var cx = Math.cos(angle)
  var cy = Math.sin(angle)
  var h = canvas.width / canvas.height

  if(Math.abs(dy) > Math.abs(dx)) {
    dx = 0
  } else {
    dy = 0
  }

  angle += 2.0 * Math.PI * dx / canvas.width
  scale += dy / Math.max(s, 1.0) / canvas.height

  var ns = Math.exp(scale)
  var ncx = Math.cos(angle)
  var ncy = Math.sin(angle)

  var bx = (2.0 * lastX / canvas.width - 1.0)
  var by = (1.0 - 2.0 * lastY / canvas.height) / h

  var x = tx - bx
  var y = ty - by

  var ux =  ncx * ns * x - ncy * ns * y
  var uy =  ncy * ns * x + ncx * ns * y

  tx =  cx / s * ux + cy / s * uy + bx
  ty = -cy / s * ux + cx / s * uy + by

  return true
})

mouseChange(function(buttons, x, y) {
  if(buttons & 1) {
    var dx = 2.0 * (x - lastX) / canvas.width
    var dy = 2.0 * (lastY - y) / canvas.width
    tx += dx
    ty += dy
  }
  lastX = x
  lastY = y
})

window.addEventListener('keypress', function(ev) {
  if(ev.keyCode === 32) {
    points.scaleNum = (points.scaleNum + 1) % points.scales.length
  }
})

var positions = new Float32Array(2 * POINT_COUNT)
for(var i=0; i<2*POINT_COUNT; ++i) {
  positions[i] = gaussRandom()
}

var points = createPoints(gl, {
  positions: positions,
  size: POINT_SIZE
})

function render() {
  requestAnimationFrame(render)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.enable(gl.DEPTH_TEST)
  points.draw(getMatrix(), Math.exp(scale))
}

render()
