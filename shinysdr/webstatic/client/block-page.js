// Copyright 2013, 2014 Kevin Reid <kpreid@switchb.org>
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

define(['./types', './values', './events', './network', './widget', './widgets'], function (types, values, events, network, widget, widgets) {
  'use strict';
  
  var any = types.any;
  var ConstantCell = values.ConstantCell;
  var LocalCell = values.LocalCell;
  var makeBlock = values.makeBlock;
  var StorageNamespace = values.StorageNamespace;
  var Index = values.Index;
  
  var exports = {};
  
  function run(stateUrl) {
    var scheduler = new events.Scheduler();
    
    var context = new widget.Context({
      widgets: widgets,
      scheduler: scheduler
    });
    
    var remoteCell = network.connect(stateUrl);
    
    function connected() {
      widget.createWidgets(remoteCell, context, document);
      
      // globals for debugging / interactive programming purposes only
      window.Dcell = remoteCell;
    }
    connected.scheduler = scheduler;
    remoteCell.n.listen(connected);
  }
  exports.run = run;
  
  return Object.freeze(exports);
});