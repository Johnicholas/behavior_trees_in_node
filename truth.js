// constructor
function Truth() {
    if (!(this instanceof Truth)) {
	return new Truth();
    }
};

Truth.prototype.start = function () {
    // do nothing
};

Truth.prototype.stop = function () {
    // do nothing
};

Truth.prototype.get = function () {
    return true;
};

module.exports = Truth;