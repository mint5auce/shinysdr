// Copyright 2014 Kevin Reid <kpreid@switchb.org>
// 
// This file is part of ShinySDR.
// 
// ShinySDR is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// ShinySDR is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with ShinySDR.  If not, see <http://www.gnu.org/licenses/>.

// TODO: remove network module depenency
require.config({
  baseUrl: '/client/'
});
define(['types', 'values', 'events', 'widget', 'widgets', 'network', 'database', 'coordination'], function (types, values, events, widget, widgets, network, database, coordination) {
  'use strict';
  
  // TODO have gui settable parameters and include these
  // These options create a less meaningful and more 'decorative' result.
  var FREQ_ADJ = false;    // Compensate for typical frequency dependence in music so peaks are equal.
  var TIME_ADJ = false;    // Subtract median amplitude; hides strong beats.
  var HIDE_LOWER = false;  // Shifts the range to put most noise offscreen.
  
  var ClientStateObject = coordination.ClientStateObject;
  var ConstantCell = values.ConstantCell;
  var makeBlock = values.makeBlock;
  
  var scheduler = new events.Scheduler();
  
  var ctx = new AudioContext();
  var sampleRate = ctx.sampleRate;
  var fftnode = ctx.createAnalyser();
  fftnode.smoothingTimeConstant = 0;
  fftnode.fftSize = 16384;
  // ignore mostly useless high freq bins
  var binCount = fftnode.frequencyBinCount / 4;
  
  var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozUserMedia || navigator.msGetUserMedia;
  getUserMedia.call(navigator, {audio: true}, function getUserMediaSuccess(stream) {
    var source = ctx.createMediaStreamSource(stream);
    source.connect(fftnode);
  }, function getUserMediaFailure(e) {
    var d = document.createElement('dialog');
    d.textContent = e;
    document.body.appendChild(d);
    d.show();
  });
  
  
  var fftcell = new network.BulkDataCell('<dummy spectrum>', new types.BulkDataType('dff', 'b'));
  var root = new ConstantCell(types.block, makeBlock({
    source: new ConstantCell(types.block, makeBlock({
      freq: new ConstantCell(Number, 0),
    })),
    receivers: new ConstantCell(types.block, makeBlock({})),
    //input_rate: new ConstantCell(Number, sampleRate),
    monitor: new ConstantCell(types.block, makeBlock({
      fft: fftcell,
      freq_resolution: new ConstantCell(Number, binCount),
      signal_type: new ConstantCell(types.any, {kind: 'USB', sample_rate: sampleRate})
    }))
  }));
  
  var context = new widget.Context({
    widgets: widgets,
    radioCell: root,  // TODO: 'radio' name is bogus
    clientState: new ClientStateObject(sessionStorage, null),  // TODO: using sessionStorage as an approximation for "no storage".
    spectrumView: null,
    freqDB: new database.Union(),
    scheduler: scheduler
  });
  
  function updateFFT() {
    var array = new Float32Array(binCount);
    fftnode.getFloatFrequencyData(array);
    
    var absolute_adj;
    if (TIME_ADJ) {
      var medianBuffer = Array.prototype.slice.call(array);
      medianBuffer.sort(function(a, b) {return a - b; });
      absolute_adj = -100 - medianBuffer[binCount / 2];
    } else {
      absolute_adj = 0;
    }
    
    var freq_adj;
    if (FREQ_ADJ) {
      freq_adj = 1;
    } else {
      freq_adj = 0;
    }
    
    var gain = -75 + absolute_adj + (HIDE_LOWER ? -50 : 0);
    var byteRangeOffset = -40;

    var buffer = new ArrayBuffer(4+8+4+4 + binCount * 1);
    var dv = new DataView(buffer);
    dv.setFloat64(4, 0, true); // freq
    dv.setFloat32(4+8, sampleRate, true);
    dv.setFloat32(4+8+4, byteRangeOffset - gain, true); // offset
    var bytearray = new Int8Array(buffer, 4+8+4+4, binCount);
    
    for (var i = 0; i < binCount; i++) {
      bytearray[i] = Math.max(-128, Math.min(127, array[i] - byteRangeOffset + freq_adj * Math.pow(i, 0.5)));
    }
    
    fftcell._update(buffer);
  }
  
  function loop() {
    // Unfortunately, we can't ask for a callback when the AnalyserNode has new data. But once per rAF seems to be almost exactly right. On my machine and so on...
    updateFFT();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  
  widget.createWidgets(root, context, document);
});