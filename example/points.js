/**
 * Test multiple points
 */
require('enable-mobile')
const setup = require('./')
const random = require('gauss-random')

//5e6 is allocation maximum
// var POINT_COUNT = 3e6
var POINT_COUNT = 1e6

var positions = new Float32Array(2 * POINT_COUNT)
for(var i=0; i<2*POINT_COUNT; ++i) {
  positions[i] = random() * 10
}



setup({
  positions:  positions,
  size:      5,
  color:     [0,0,0,1],
  borderSize: 1,
  snapPoints: true,
  borderColor: [.5,.5,.5,.5]
})

