/*
There's a tree of executors, made up of internal nodes such as seq, par, and
rules, as well as command leaves.

Events bounce like a pachinko ball from the top of the tree down
into (ideally), the leaf that sent that command.

Signal changes also flow from the top of the tree down,
but they split (at par and rules nodes) so that multiple parts of the tree
can react to the same change.

all executors have:
* a start(handler) method (handler is a callback for when it's done)
* a handle(device) method
* a get_devices method that returns the set of devices it uses
* a signal_changed method
* a stop method (for early stops)

seq:
* has a state variable, the current step
* when started, starts its first step
* delegates handle(device) to its current step
* on get_devices returns the union of the get_devices of
its steps
* acts as a handler to its steps and when it gets a "done", increments the
current step and either starts the next step, or calls done on its handler
* delegates signal_changed to its current step
* delegates stop to its current step

par:
* when constructed, builds a map from devices to lanes that handle that device
(e.g. x_axis=>robot_lane, z_axis=>robot_lane, carousel_axis=>spu_lane)
* when started, starts all its lanes
* when it gets a handle(device), delegates to the lane that handles that device
* when it gets a get_devices(), returns the union of the get_devices() of its
steps
* acts as a handler to its steps and when it gets a "done", removes that lane
from a set of lanes it is waiting for, and if there are none left, calls done
on its handler
* delegates signal_changed to all its running lanes
* delegates stop to all its running lanes

rules:
* when started, walks sequentially down the sequence of pairs, and starts the
first executor whose guard returns true.
* delegates handle(device) to the currently running executor
* on get_device, returns the union of get_devices of its executors
* delegates stop to the currently running executor
* acts as a handler to its executors and when a done comes back from a child
executor, rules is done.
* when a signal_changed event occurs:
1. walks sequentially down the guards prior to the currently running executor
(previously, these guards were false), and if one of them now returns true,
stops the currently running executor and starts the pre-empting executor
2. tests the currently running executor's guard. If it returns true, delegates
to the currently running executor.
3. if the currently running executor's guard returns false, it was 
disqualified. We stop it, and walk down the remaining guards, and if one of
them returns true, we start the associated executor (and store it as the
currently running executor).

commands generally:
* when started, sends a command to the device (essentially a sequence of pokes)
* when it gets a handle(device), calls done on its handler
* when it gets a get_devices(), returns its one device

guards generally:
* have a start method
* have a stop method
* have a get method, that returns a boolean

*/

var Seq = require('bSn/seq');
var Par = require('bSn/par');
var Rules = require('bSn/rules');

function MockMaker(tester) {
    this.tester = tester;
};

MockMaker.prototype.command = function (config) {
    var tester = this.tester;
    config.start = function (handler) {
	tester.strictEqual(handler, this.parent);
    };
    config.get_devices = function (accum) {
	accum[this.device] = true;
    };
    config.handle = function (device) {
	tester.ok(this.expect_handle);
	tester.strictEqual(device, this.device);
    };
    config.signal_changed = function () {
	tester.ok(this.expect_signal);
    };
    config.stop = function () {
	tester.ok(this.expect_stop);
    };
    return config;
}

MockMaker.prototype.handler = function (config) {
    var tester = this.tester;
    config.done = function (which) {
	tester.ok(this.expect_done);
	if (this.expect_done) {
	    tester.strictEqual(this.plan, which);
	}
    };
    return config;
}

MockMaker.prototype.guard = function (config) {
    var tester = this.tester;
    config.start = function () {
	tester.ok(this.expect_start);
    };
    config.stop = function () {
	tester.ok(this.expect_stop);
    };
    config.get = function () {
	tester.ok(this.expect_get);
	return this.answer;
    };
    return config;
};

exports.test_seq_starts_its_first_step = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    tester.expect(1);
    to_test.start(maker.handler({}));
    tester.done();
};

exports.test_seq_delegates_to_its_current_step = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_handle: true
    }));
    tester.expect(3);
    to_test.start(maker.handler({}));
    to_test.handle('x_axis');
    tester.done();
};

exports.test_seq_get_devices_is_union_of_steps = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    var answer = {};

    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis'
    }));
    tester.expect(2);
    to_test.get_devices(answer);
    tester.ok(answer.x_axis);
    tester.ok(answer.z_axis);
    tester.done();
};

exports.test_seq_increments_the_current_steps = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    var first_step = maker.command({
	parent: to_test,
	device: 'x_axis'
    });
    to_test.add(first_step);
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis'
    }));
    tester.expect(2);
    to_test.start(maker.handler({}));
    to_test.done(first_step);
    tester.done();
};

exports.test_seq_calls_done_when_it_cannot_increment = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    var first_step = maker.command({
	parent: to_test,
	device: 'x_axis'
    });
    to_test.add(first_step);
    tester.expect(3);
    to_test.start(maker.handler({
	expect_done: true, plan: to_test
    }));
    to_test.done(first_step);
    tester.done();
};

exports.test_seq_delegates_signal_changed_to_its_current = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_signal: true
    }));
    tester.expect(2);
    to_test.start(maker.handler({}));
    to_test.signal_changed();
    tester.done();
};

exports.test_seq_delegates_stop_to_its_current = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Seq();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_stop: true
    }));
    tester.expect(2);
    to_test.start(maker.handler({}));
    to_test.stop();
    tester.done();
};

exports.test_par_starts_all_its_lanes = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis'
    }));
    tester.expect(2);
    to_test.start(maker.handler({}));
    tester.done();
};

exports.test_par_delegates_to_the_lane_for_that_device = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_handle: true
    }));
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis',
	expect_handle: true
    }));
    tester.expect(6);
    to_test.start(maker.handler({}));
    to_test.handle('x_axis');
    to_test.handle('z_axis');
    tester.done();
};

exports.test_par_sees_that_lanes_share_devices_and_throws = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    tester.expect(1);
    tester.throws(function () {
	to_test.add({
	    get_devices: function (accum) {
		accum.x_axis = true;
	    }
	});
    });
    tester.done();
};

exports.test_par_get_devices_is_union_of_lanes = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    var answer = {};

    to_test.add(maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis'
    }));
    tester.expect(2);
    to_test.get_devices(answer);
    tester.ok(answer.x_axis);
    tester.ok(answer.z_axis);
    tester.done();
};

exports.test_par_is_done_when_all_of_its_lanes_are_done = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    var x_lane = maker.command({
	parent: to_test,
	device: 'x_axis'
    });
    var z_lane = maker.command({
	parent: to_test,
	device: 'z_axis'
    });
    to_test.add(x_lane);
    to_test.add(z_lane);
    tester.expect(4);
    to_test.start(maker.handler({
	expect_done: true, plan: to_test
    }));
    to_test.done(x_lane);
    to_test.done(z_lane);
    tester.done();
};

exports.test_par_is_not_done_when_not_all_lanes_are_done = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    var x_lane = maker.command({
	parent: to_test,
	device: 'x_axis'
    });
    var z_lane = maker.command({
	parent: to_test,
	device: 'z_axis'
    });
    to_test.add(x_lane);
    to_test.add(z_lane);
    tester.expect(2);
    to_test.start(maker.handler({}));
    to_test.done(x_lane);
    tester.done();
};

exports.test_par_delegates_signal_changed_to_running_lanes = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    var x_command = maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_signal: false
    });
    to_test.add(x_command);
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis',
	expect_signal: true
    }));
    tester.expect(3);
    to_test.start(maker.handler({}));
    to_test.done(x_command);
    to_test.signal_changed();
    tester.done();
};

exports.test_par_delegates_stop_to_running_lanes = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Par();
    var x_command = maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_stop: false
    });
    to_test.add(x_command);
    to_test.add(maker.command({
	parent: to_test,
	device: 'z_axis',
	expect_stop: true
    }));
    tester.expect(3);
    to_test.start(maker.handler({}))
    to_test.done(x_command);
    to_test.stop();
    tester.done();
};

exports.test_rules_starts_the_first_with_a_true_guard = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: false
    }), maker.command({}));
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: true
    }), maker.command({
	parent: to_test,
	device: 'x_axis'
    }));
    tester.expect(5);
    to_test.start(maker.handler({}));
    tester.done();
};

exports.test_rules_delegates_to_the_currently_running = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: false
    }), maker.command({}));
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: true
    }), maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_handle: true
    }));
    tester.expect(7);
    to_test.start(maker.handler({}));
    to_test.handle('x_axis');
    tester.done();
};

exports.test_rules_on_get_device_returns_union = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    var answer = {};

    to_test.add(maker.guard({}),maker.command({device: 'x_axis'}));
    to_test.add(maker.guard({}),maker.command({device: 'z_axis'}));
    tester.expect(2);
    to_test.get_devices(answer);
    tester.ok(answer.x_axis);
    tester.ok(answer.z_axis);
    tester.done();
};

exports.test_rules_delegates_stop_to_currently_running = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: false
    }), maker.command({}));
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true,
	answer: true
    }), maker.command({
	parent: to_test,
	device: 'x_axis',
	expect_handle: true,
	expect_stop: true
    }));
    tester.expect(6);
    to_test.start(maker.handler({}));
    to_test.stop();
    tester.done();
};

exports.test_rules_handles_done = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    var action = maker.command({
	parent: to_test,
	device: 'x_axis',
    });
    to_test.add(maker.guard({
	expect_start: true,
	expect_stop: true,
	expect_get: true,
	answer: true
    }), action);
    tester.expect(6);
    to_test.start(maker.handler({
	expect_done: true,
	plan: to_test
    }));
    to_test.done(action);
    tester.done();
};

exports.test_rules_earlier_rules_can_preempt = function (tester) {
    console.log('preemption test starting');
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    var first_guard = maker.guard({
	expect_start: true,
	expect_get: true, answer: false
    });
    to_test.add(first_guard, maker.command({
	parent: to_test
    }));
    to_test.add(maker.guard({
	expect_start: true,
	expect_get: true, answer: true,
	expect_stop: true
    }), maker.command({
	parent: to_test,
	expect_stop: true
    }));
    tester.expect(9);
    to_test.start(maker.handler({}));
    first_guard.answer = true;
    to_test.signal_changed();
    tester.done();
};

exports.test_rules_current_guard_can_disqualify = function (tester) {
    console.log('disqualification test starting');
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    var first_guard = maker.guard({
	expect_start: true,
	expect_get: true, answer: false
    });
    var second_guard = maker.guard({
	expect_start: true,
	expect_get: true, answer: true
    });
    var second_action = maker.command({
	parent: to_test
    });
    var third_guard = maker.guard({
	expect_start: true,
	expect_get: true, answer: true
    });
    to_test.add(first_guard, maker.command({}));
    to_test.add(second_guard, second_action);
    to_test.add(third_guard, maker.command({
	parent: to_test,
	expect_handle: true, device: 't_device'
    }));
    tester.expect(12);
    to_test.start(maker.handler({
	expect_done: true, plan: to_test
    }));
    second_guard.answer = false;
    to_test.signal_changed();
    second_action.expect_handle = true;
    to_test.handle('t_device');
    tester.done();
};

exports.test_rules_delegates_signal_if_guard_is_true = function (tester) {
    var maker = new MockMaker(tester);
    var to_test = new Rules();
    to_test.add(maker.guard({
	expect_get: true, answer: true,
	expect_start: true
    }), maker.command({
	expect_start: true, parent: to_test,
	expect_signal: true
    }));
    tester.expect(5);
    to_test.start(maker.handler({}));
    to_test.signal_changed();
    tester.done();
};

