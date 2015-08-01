require("./$.Date");
require("./$.Array");
require("./$.Object");

function Console() {
	this.before = [];
	this.date_format = "hh:mm:ss MM-DD";
	this.timeMap = {};
	for(var i in this){
		if (typeof this[i] === "function") {
			this[i] = this[i].bind(this);
		}
	}
};
var _console = global.console;
global.nactive_console = _console;
Console.prototype = {
	addBefore: function(arr) {
		arr = Array.slice(arr);
		if (this.before.length) {
			Array.unshift(arr, this.before);
		}
		return arr;
	},
	log: function() {
		var args = this.addBefore(arguments);
		_console.log.apply(_console, args);
	},
	info: function() {
		var args = this.addBefore(arguments);
		_console.info.apply(_console, args);
	},
	debug: function() {
		var args = this.addBefore(arguments);
		_console.debug.apply(_console, args);
	},
	warn: function() {
		var args = this.addBefore(arguments);
		_console.warn.apply(_console, args);
	},
	error: function() {
		var args = this.addBefore(arguments);
		_console.error.apply(_console, args);
	},
	assert: _console.assert,
	trace: _console.trace,
	time: function() {
		var start_date = new Date;
		var time_str = Array.slice(arguments).join(" ");
		this.timeMap[time_str] = start_date;

		this.before.push("┌ (" + start_date.format(this.date_format) + ")");
		var args = this.addBefore(arguments);
		_console.log.apply(_console, args);

		this.before.pop();
		this.before.push("│ ");
	},
	timeEnd: function() {
		var end_date = new Date;
		var time_str = Array.slice(arguments).join(" ");
		if (!this.timeMap.hasPro(time_str)) {
			throw new Error("No such label: " + time_str);
		}
		var start_date = this.timeMap[time_str];

		this.before.pop();
		this.before.push("└ (" + end_date.format(this.date_format) + ")");
		var args = this.addBefore(arguments);
		args.push(": " + (end_date - start_date) + "ms");
		_console.log.apply(_console, args);
		this.before.pop();
	},
	group: function() {
		this.before.push("┌ [STR GROUP]");
		var args = this.addBefore(arguments);
		_console.log.apply(_console, args);

		this.before.pop();
		this.before.push("│ ");
	},
	groupEnd: function() {
		this.before.pop();
		this.before.push("└ [END GROUP]");
		var args = this.addBefore(arguments);
		_console.log.apply(_console, args);
		this.before.pop();
	}
};

delete global.console
global.console = global.con = new Console;

/*TEST*/
// con = new Console;
// con.time("aaa", 1);
// con.time("aaa", 2);
// con.log("hahha");
// con.timeEnd("aaa", 2);
// con.timeEnd("aaa", 1);

// con.group("xx")
// con.log("hahha1");
// con.group("xx")
// con.log("hahha2");
// con.group("xx")
// con.log("hahha3");
// con.groupEnd("haha1")
// con.log("hahha4");
// con.groupEnd("haha2")
// con.log("hahha5");
// con.groupEnd("haha3")