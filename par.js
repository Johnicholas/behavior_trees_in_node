// constructor
function Par() {
    if (!(this instanceof Par)) {
     return new Par();
    }
    this.lanes = [];
    this.map = {};
};

// mutator
Par.prototype.add = function (to_add) {
    var devices = {};
    var i;

    this.lanes.push(to_add);
    to_add.get_devices(devices);
    for (device in devices) {
	if (this.map[device]) {
	    throw 'overlap between lanes';
	} else {
	    this.map[device] = to_add;
	}
    }
};

Par.prototype.start = function (handler) {
    var i;

    this.handler = handler;
    this.undone = [];
    for (i = 0; i < this.lanes.length; i += 1) {
	this.lanes[i].start(this);
	this.undone.push(true);
    }
    this.undone_count = this.lanes.length;
};

Par.prototype.handle = function (device) {
    var lane = this.map[device]
    if (typeof lane == 'object') {
	lane.handle(device);
    } else {
	throw 'par saw unexpected handle ' + device;
    }
};

Par.prototype.get_devices = function (accum) {
    for (device in this.map) {
	accum[device] = true;
    }
};

Par.prototype.done = function (which) {
    var lane_number = this.lanes.indexOf(which);
    if (lane_number == -1) {
	throw 'par saw unexpected done';
    }
    if (!this.undone[lane_number]) {
	throw 'par saw more than one done per lane';
    }
    this.undone[lane_number] = false;
    this.undone_count -= 1;
    if (this.undone_count == 0) {
	this.handler.done(this);
    }
};

Par.prototype.signal_changed = function () {
    var i;

    for (i = 0; i < this.undone.length; i += 1) {
	if (this.undone[i]) {
	    this.lanes[i].signal_changed();
	}
    }
};

Par.prototype.stop = function () {
    var i;

    for (i = 0; i < this.undone.length; i += 1) {
	if (this.undone[i]) {
	    this.lanes[i].stop();
	}
    }
};

module.exports = Par;
