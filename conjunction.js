// constructor
function Conjunction(lhs, rhs) {
    if (!(this instanceof Conjunction)) {
	return new Conjunction(lhs, rhs);
    }
    this.lhs = lhs;
    this.rhs = rhs;
};

Conjunction.prototype.start = function () {
    this.lhs.start();
    this.rhs.start();
};

Conjunction.prototype.stop = function () {
    this.lhs.stop();
    this.rhs.stop();
};

Conjunction.prototype.get = function () {
    return this.lhs.get() && this.rhs.get();
};

module.exports = Conjunction;
