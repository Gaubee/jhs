var pathRegexp = require('path-to-regexp');
var noop = function noop() {}

function Filter(path, options) {
	if (!(this instanceof Filter)) {
		return new Filter(path, options);
	}
	var self = this;
	options = options || {};

	self.handles = [];

	self.params = undefined;
	self.path = undefined;
	self.regexp = pathRegexp(path, self.keys = [], options);

	if (path === '/' && options.end === false) {
		self.regexp.fast_slash = true;
	}
};
Filter.prototype.math = function(path) {
	var self = this;
	if (path == null) {
		// no path, nothing matches
		self.params = undefined;
		self.path = undefined;
		return false;
	}

	if (self.regexp.fast_slash) {
		// fast path non-ending match for / (everything matches)
		self.params = {};
		self.path = '';
		return true;
	}

	var m = self.regexp.exec(path);

	if (!m) {
		self.params = undefined;
		self.path = undefined;
		return false;
	}

	// store values
	self.params = {};
	self.path = m[0];

	var keys = self.keys;
	var params = self.params;
	var prop;
	var n = 0;
	var key;
	var val;

	for (var i = 1, len = m.length; i < len; ++i) {
		key = keys[i - 1];
		prop = key ? key.name : n++;
		val = decode_param(m[i]);

		if (val !== undefined || !(hasOwnProperty.call(params, prop))) {
			params[prop] = val;
		}
	}

	return true;
};
Filter.prototype.addHandle = function(handle) {
	this.handles.push(handle);
	return this;
};
Filter.prototype.emitHandle = function() {
	var args = Array.prototype.slice.call(arguments);
	var self = this;
	self.handles.forEach(function(handle) {
		if (handle instanceof Function) {
			handle.apply(self, args);
		}
	});
	return self;
};

function decode_param(val) {
	if (typeof val !== 'string') {
		return val;
	}

	try {
		return decodeURIComponent(val);
	} catch (e) {
		var err = new TypeError("Failed to decode param '" + val + "'");
		err.status = 400;
		throw err;
	}
};
var cacheArr = [];
var cacheMap = cacheArr.map = {};
var filter = {
	Filter: Filter,
	cache: cacheArr,
	get: function(path) {
		var f = cacheMap[path];
		if (!(f instanceof Filter)) {
			f = cacheMap[path] = new Filter(path);
			cacheArr.push(f);
		}
		return f;
	}
};
module.exports = filter;