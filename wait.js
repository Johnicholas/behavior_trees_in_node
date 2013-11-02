
// constructor
function Wait() {
    if (!(this instanceof Wait)) {
	return new Wait();
    }
};

Wait.prototype.start = function (handler) {
    // do nothing
};

Wait.prototype.handle = function (device) {
    // do nothing
};

Wait.prototype.get_devices = function (accum) {
    // do nothing
    return accum;
};

Wait.prototype.signal_changed = function () {
    // do nothing
};

Wait.prototype.stop = function () {
    // do nothing
};

module.exports = Wait;
