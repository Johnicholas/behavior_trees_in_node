// constructor
function Seq() {
    if (!(this instanceof Seq)) {
     return new Seq();
    }
    this.steps = [];
};

// mutator
Seq.prototype.add = function (to_add) {
    this.steps.push(to_add);
};

// precondition: not running e.g. this.current_steps === null
Seq.prototype.start = function (handler) {
    this.steps[0].start(this);
    this.current_step = 0;
    this.handler = handler;
};

// precondition: running e.g. typeof this.current_steps === 'number'
Seq.prototype.handle = function (device) {
    this.steps[this.current_step].handle(device);
};

Seq.prototype.get_devices = function (accum) {
    var i;

    for (i = 0; i < this.steps.length; i += 1) {
	this.steps[i].get_devices(accum);
    }
    return accum;
};

// precondition: running e.g. typeof this.current_steps === 'number'
Seq.prototype.done = function (which) {
    var temp;

    this.current_step += 1;
    if (this.current_step < this.steps.length) {
	this.steps[this.current_step].start(this);
    } else {
	this.current_step = null;
	temp = this.handler;
	this.handler = null;
	temp.done(this);
    }
};

// precondition: running e.g. typeof this.current_steps === 'number'
Seq.prototype.signal_changed = function () {
    this.steps[this.current_step].signal_changed();
};

// precondition: running e.g. typeof this.current_steps === 'number'
Seq.prototype.stop = function () {
    this.steps[this.current_step].stop();
};

module.exports = Seq;
