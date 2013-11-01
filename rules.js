// constructor
function Rules() {
    if (!(this instanceof Rules)) {
     return new Rules();
    }
    this.guards = [];
    this.actions = [];
};

// mutator
Rules.prototype.add = function (guard, action) {
    this.guards.push(guard);
    this.actions.push(action);
};

Rules.prototype.start = function (handler) {
    var i;

    this.handler = handler;
    for (i = 0; i < this.guards.length; i += 1) {
	this.guards[i].start();
	if (this.guards[i].get()) {
	    this.running = i;
	    this.actions[i].start(this);
	    return;
	}
    }
    throw 'rules unexpectedly got to the end of its rule-list'; 
};

Rules.prototype.get_devices = function (accum) {
    var i;

    for (i = 0; i < this.actions.length; i += 1) {
	this.actions[i].get_devices(accum);
    }
};

// precondition: running e.g. typeof this.running === 'number'
Rules.prototype.handle = function (device) {
    this.actions[this.running].handle(device);
};

// precondition: running e.g. typeof this.running === 'number'
Rules.prototype.stop = function () {
    this.actions[this.running].stop();
};

// precondition: running e.g. typeof this.running === 'number'
Rules.prototype.done = function (which) {
    var i;

    if (which != this.actions[this.running]) {
	throw 'rules saw unexpected done';
    }
    for (i = this.running; i >= 0; i -= 1) {
	this.guards[i].stop();
    }
    this.handler.done(this);
};

// precondition: running e.g. typeof this.running === 'number'
Rules.prototype.signal_changed = function () {
    var i;
    var j;

    for (i = 0; i < this.running; i += 1) {
	if (this.guards[i].get()) {
	    this.actions[this.running].stop();
	    for (j = this.running; j > i; j -= 1) {
		this.guards[j].stop();
	    }
	    this.actions[i].start(this);
	    return;
	}
    }
    if (this.guards[this.running].get()) {
	this.actions[this.running].signal_changed();
    } else {
	this.actions[this.running].stop();
	for (j = this.running+1; j < this.actions.length; j += 1) {
	    this.guards[j].start();
	    if (this.guards[j].get()) {
		this.running = j;
		this.actions[j].start(this);
		return;
	    }
	}
	throw 'rules unexpectedly got to the end of its rule-list'; 
    }
};

module.exports = Rules;
