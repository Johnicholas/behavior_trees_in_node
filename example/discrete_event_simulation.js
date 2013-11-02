// This is a weird/stupid simple discrete-event simulation.
// The idea is that we're trying to build just enough of a world,
// that you might need Rules and/or Conjunction in order to specify
// a strategy for living in that world.
//
// There are two kinds of things that you can buy,
// which each yield residual income.
// However, you sometimes lose them and/or they decay,
// which means you need to re-buy them.
// Also, one of the two investments is guarded by
// monsters Scylla and Charybdis, who each sleep irregularly.
// If you try to buy investment_2 when either of them are awake,
// you lose your money but don't get the investment.

'use strict';
var Rules = require('bSn/rules');
var Conjunction = require('bSn/conjunction');
var Truth = require('bSn/truth');
var Wait = require('bSn/wait');

// TODO: class Monster
// TODO: class Investment

// globals
var scylla_awake = false;
var scylla_subscriptions = 0;
var charybdis_awake = false;
var charybdis_subscriptions = 0;
var investment_1_owned = false;
var investment_1_subscriptions = 0;
var investment_2_owned = false;
var investment_2_subscriptions = 0;
var cash = 100;

// scylla_asleep is a guard, true if scylla is asleep
var scylla_asleep = {
    start: function () {
	scylla_subscriptions += 1;
    },
    stop: function () {
	scylla_subscriptions -= 1;
    },
    get: function () {
	return !scylla_awake;
    }
};

// charybdis_asleep is a guard, true if charybdis is asleep
var charybdis_asleep = {
    start: function () {
	charybdis_subscriptions += 1;
    },
    stop: function () {
	charybdis_subscriptions -= 1;
    },
    get: function () {
	return !charybdis_awake;
    }
};

// investment_1_not_owned is a guard, true if investment_1 is not owned
var investment_1_not_owned = {
    start: function () {
	investment_1_subscriptions += 1;
    },
    stop: function () {
	investment_1_subscriptions -= 1;
    },
    get: function () {
	return !investment_1_owned;
    }
};

// investment_2_not_owned is a guard, true if investment_2 is not owned
var investment_2_not_owned = {
    start: function () {
	investment_2_subscriptions += 1;
    },
    stop: function () {
	investment_2_subscriptions -= 1;
    },
    get: function () {
	return !investment_2_owned;
    }
};

// generates a random number according to the geometric distribution
function geometric(p) {
    var answer = 1;
    var x = Math.random();
    while (x < p) {
	x = Math.random();
	answer += 1;
    }
    // console.log('geometric(' + p + ') is ' + answer);
    return answer;
};

// a simple discrete-event-simulation upcoming-events "priority queue"
// (no sophisticated data structure, just array sort)
var scheduler = {
    queue: [],
    now: 0,
    run: function (limit) {
	var current;
	var dt;

	this.queue.sort(function (a, b) { return a.timestamp < b.timestamp; });
	while (this.queue.length > 0 && this.now < limit) {
	    current = this.queue.pop();
	    dt = current.timestamp - this.now;
	    // we do continous-time phenomena up to the next event.
	    if (investment_1_owned) { cash += dt; }
	    if (investment_2_owned) { cash += dt; }
	    cash -= Math.min(cash, dt); // overhead
	    // then we do the event itself.
	    this.now = current.timestamp;
	    current.run(this);
	    this.queue.sort(function (a, b) { return a.timestamp < b.timestamp; });
	}
    },
    add: function (event, when) {
	event.timestamp = this.now + when;
	this.queue.push(event);
    }
};

// toggle scylla is an event where scylla wakes or goes to sleep
var toggle_scylla = {
    timestamp: geometric(0.8),
    run: function (scheduler) {
	console.log('scylla '+(scylla_awake?'goes to sleep':'wakes up'));
	scylla_awake = !scylla_awake;
	if (scylla_subscriptions > 0) {
	    strategy.signal_changed();
	}
	scheduler.add(this, geometric(0.8));
    }
};
scheduler.add(toggle_scylla, geometric(0.8));

// toggle charybdis is an event where charybdis wakes or goes to sleep
var toggle_charybdis = {
    run: function (scheduler) {
	console.log('charybdis '+(charybdis_awake?'goes to sleep':'wakes up'));
	charybdis_awake = !charybdis_awake;
	if (charybdis_subscriptions > 0) {
	    strategy.signal_changed();
	}
	scheduler.add(this, geometric(0.8));
    }
};
scheduler.add(toggle_charybdis, geometric(0.8));

// investment_1_bought is an event where investment_1 was ordered to be bought
var investment_1_bought = {
    run: function (scheduler) {
	strategy.handle('investment_1');
    }
};

// investment_1_decays is an event where investment_1 is lost/destroyed
var investment_1_decays = {
    run: function (scheduler) {
	console.log('investment 1 decays');
	investment_1_owned = false;
	if (investment_1_subscriptions > 0) {
	    strategy.signal_changed();
	}
    }
};

// investment_2_bought is an event where investment_2 was ordered to be bought
var investment_2_bought = {
    run: function (scheduler) {
	strategy.handle('investment_2');
    }
};


// investment_2_decays is an event where investment_2 is lost/destroyed
var investment_2_decays = {
    run: function (scheduler) {
	console.log('investment 2 decays');
	investment_2_owned = false;
	if (investment_2_subscriptions > 0) {
	    strategy.signal_changed();
	}
    }
};

// buy investment_1 is an executor that just buys investment_1
var buy_investment_1 = {
    start: function (handler) {
	this.handler = handler;
	if (cash > 0) {
	    cash -= 1;
	    if (!investment_1_owned) {
		console.log('bought investment 1');
		investment_1_owned = true;
		scheduler.add(investment_1_bought, 1);
		scheduler.add(investment_1_decays, geometric(0.6));
	    } else {
		console.log('WASTED MONEY BUYING INVESTMENT 1 WHILE ALREADY OWNED');
	    }
	} else {
	    console.log('tried to buy investment 1 but out of cash');
	}
    },
    handle: function (device) {
	this.handler.done(this);
    },
    get_devices: function (accum) {
	// ignore
	return accum;
    },
    signal_changed: function () {
	// ignore
    },
    stop: function () {
	// ignore
    }
};

// buy investment_2 is an executor that just buys investment_2
// note that if either scylla or charybdis are awake, they prevent it
var buy_investment_2 = {
    start: function (handler) {
	this.handler = handler;
	if (cash > 0) {
	    cash -= 1;
	    if (!scylla_awake && !charybdis_awake && !investment_2_owned) {
		console.log('bought investment 2');
		investment_2_owned = true;
		scheduler.add(investment_2_bought, 1);
		scheduler.add(investment_2_decays, geometric(0.9));
	    } else {
		console.log('WASTED MONEY BUYING INVESTMENT 2 WHEN CANNOT');
	    }
	} else {
	    console.log('tried to buy investment 2 but out of cash');
	}
    },
    handle: function (device) {
	this.handler.done(this);
    },
    get_devices: function (accum) {
	// ignore
	return accum;
    },
    signal_changed: function () {
	// ignore
    },
    stop: function () {
	// ignore
    }
};

var strategy = new Rules();
strategy.add(new Conjunction(new Conjunction(scylla_asleep, charybdis_asleep), 
			     investment_2_not_owned), buy_investment_2);
//strategy.add(new Conjunction(scylla_asleep, investment_2_not_owned),
//	     buy_investment_2);
strategy.add(investment_1_not_owned, buy_investment_1);
strategy.add(new Truth(), new Wait());

// actually do it
var loop = {
    done: function (strategy) {
	strategy.start(this);
    }
};
strategy.start(loop);
scheduler.run(1000);
console.log('cash is ' + cash);


