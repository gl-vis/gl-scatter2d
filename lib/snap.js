'use strict'

module.exports = snapPoints

var pool = require('typedarray-pool')

function PointInterval(scale, count) {
  this.scale = scale
  this.count = count
}

function partitionLines(points, ids, start, end, lox, loy, hix, hiy) {
  var mid = start
  for(var i=start; i<end; ++i) {
    var x  = points[2*i]
    var y  = points[2*i+1]
    var s  = ids[i]
    if(lox <= x && x <= hix &&
       loy <= y && y <= hiy) {
      if(i === mid) {
        mid += 1
      } else {
        points[2*i]     = points[2*mid]
        points[2*i+1]   = points[2*mid+1]
        ids[i]          = ids[mid]
        points[2*mid]   = x
        points[2*mid+1] = y
        ids[mid]        = s
        mid += 1
      }
    }
  }
  return mid
}

function VisitRecord(x, y, diam, start, end) {
  this.x = x
  this.y = y
  this.diam = diam
  this.start = start
  this.end = end
}

function sortPoints(points, subdiv, output, outputId, bounds) {
  var n    = points.length >>> 1
  if(n < 1) {
    return []
  }
  var ids = pool.mallocInt32(n)
  var lox =  Infinity, loy =  Infinity
  var hix = -Infinity, hiy = -Infinity
  for(var i=0; i<n; ++i) {
    var x = points[2*i]
    var y = points[2*i+1]
    lox = Math.min(lox, x)
    hix = Math.max(hix, x)
    loy = Math.min(loy, y)
    hiy = Math.max(hiy, y)
    ids[i] = i
  }
  var scaleX = 1.0 / (hix - lox)
  var scaleY = 1.0 / (hiy - loy)
  var diam = Math.max(hix - lox, hiy - loy)

  bounds[0] = lox
  bounds[1] = loy
  bounds[2] = hix
  bounds[3] = hiy

  var toVisit = [ new VisitRecord(lox, loy, diam, 0, n) ]
  var ptr = n-1
  var qptr = 0

  var scales = [ new PointInterval(diam, n-1) ]
  var lastScale = diam

  while(qptr < toVisit.length) {
    var head = toVisit[qptr++]
    var x = head.x
    var y = head.y
    var d = head.diam
    var start = head.start
    var end = head.end
    output[2*ptr]   = (points[2*start]   - lox) * scaleX
    output[2*ptr+1] = (points[2*start+1] - loy) * scaleY
    outputId[ptr]   = ids[start]
    ptr   -= 1
    start += 1
    if(d < lastScale) {
      scales.push(new PointInterval(d, ptr))
    }
    lastScale = d
    var s = d / subdiv
    for(var i=0; i<=subdiv; ++i) {
      for(var j=0; j<=subdiv; ++j) {
        var x0 = x + s * i
        var y0 = y + s * j
        var mid = partitionPoints(
          points,
          ids,
          start,
          end,
          x0, y0,
          x + s*(i+1), y + s*(j+1))
        if(start < mid) {
          toVisit.push(new VisitRecord(x0, y0, s, start, mid))
          start = mid
        }
      }
    }
  }

  pool.free(ids)
  scales.push(new PointInterval(lastScale, 0))

  return scales
}
