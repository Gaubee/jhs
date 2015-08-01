function noop() {};
var cacheMap = {};
var path = require("path");
var fs = require("fs");
var filetype = require("./filetype");
var _file_cahce_prefix_ = Math.random().toString() + ":";
var _clock_cahce_prefix_ = Math.random().toString() + ":";

function format_state(state) {
	var res = {};
	for (var i in state) {
		if (state.hasOwnProperty(i)) {
			res[i] = +state[i];
		}
	}
	return res;
};

function equal_state(state_1, state_2) {
	for (var i in state_1) {
		if (state_1[i] !== state_2[i]) {
			return false;
		}
	}
	return true;
};
var delay_time = Object.create(null);
var cache = {
	cache: cacheMap,
	options: {
		file_cache_time: 500
	},
	getCache: function(key) {
		return cacheMap[key];
	},
	buildCache: function(key, default_value) {
		return cacheMap[key] || (cacheMap[key] = default_value);
	},
	setCache: function(key, value) {
		return (cacheMap[key] = value);
	},
	delaySetCache: function(key, value, time) {
		setTimeout(function() {
			cacheMap[key] = value
		}, time);
		return value;
	},
	setTimeDelaySetCache: function(key, value, time) {
		if (!delay_time[key]) {
			delay_time[key] =
				setTimeout(function() {
					cacheMap[key] = value
				}, time);
		}
		return delay_time[key];
	},
	clearTimeDelaySetCache: function(key) {
		clearTimeout(delay_time[key])
	},
	removeCache: function(key) {
		return cache.setCache(key, void 0);
	},
	getFileCache: function(pathname) { //@Gaubee [高效文件缓存机制的实现](https://github.com/Gaubee/blog/issues/81)
		pathname = path.normalize(pathname);
		var file_key = _file_cahce_prefix_ + pathname;
		//文件缓存，如果没有创建一个空的
		var file_cache = cache.buildCache(file_key, {
			pathname: pathname
		});
		/*
		 * 如果有缓存的 文件信息 ，则说明上一次访问这个文件的时间超过了file_cache_time，这时候重新校验文件信息
		 */
		if (file_cache.state) {
			var new_state = format_state(fs.lstatSync(pathname));
			//如果文件改变了，缓存清除，文件会被重新读取，文件信息会在file_cache_time后重新写入供给检查
			if (!equal_state(new_state, file_cache.state)) {
				// cache.removeCache(content_key);
				file_cache.source_content = null;
			} else { //如果文件没有变，清除文件信息，并在file_cache_time后重写
				setTimeout(function() {
					file_cache.state = new_state;
				}, cache.options.file_cache_time)
			}
			//不论校验结果，都移除这个文件信息
			file_cache.state = null;
		}
		//如果没有文件信息，说明这个文件还没读取到缓存中，则进行初始化
		if (typeof file_cache.source_content !== "string") {
			file_cache.source_content = fs.readFileSync(pathname);
			file_cache.source_md5 = $$.md5(file_cache.source_content);
			// console.log(pathname, "filetype:", filetype(file_cache.source_content));
			if (!filetype(file_cache.source_content)) {
				file_cache.is_text = true;
				file_cache.source_content = file_cache.source_content.toString();
			}
			//0.5s后才将这个state值写入缓存中，这样能确保这个文件缓存至少能够使用0.5s
			setTimeout(function() {
				file_cache.state = new_state || format_state(fs.lstatSync(pathname));
			}, cache.options.file_cache_time)
		}
		return file_cache;
	},
	getFileCacheContent: function(pathname) {
		return cache.getFileCache(pathname).source_content
	},
	/*
	 * 四种缓存模式
	 * 1. normal
	 *    要求参数 : get_value_handle(retrun_cb, _update_cache)
	 * 2. time
	 *    要求参数 : get_value_handle(return_cb)
	 *               time
	 * 3. bofore
	 *    要求参数 : get_value_handle(return_cb)
	 *               before_get_value_handle(_update_cache, then)
	 * 4. time_and_before（如果before_handle的性能开销过大，应使用这种混合模式）
	 *    要求参数 : get_value_handle(return_cb)
	 *               time
	 *               before_get_value_handle(_update_cache, then)
	 */
	defineClockCache: function(key, type, options) {
		options || (options = {});
		var _clock_key = _clock_cahce_prefix_ + key;
		var res = {
			key: key,
			debug: options.debug ? console.log : noop,
			value: void 0,
			is_latest: false
		};
		type = type.toLowerCase();
		if (typeof options.get_value_handle !== "function") {
			throw new TypeError("typeof get_value_handle should be function");
		}
		//简单模式，事件通知式的更新方案
		if (type === "n" || type === "normal") {
			res.type = "normal";
			res.get_value_handle = options.get_value_handle;
		} else { //手动更新式，比较复杂
			if (type === "t" || type === "time" || type === "tb" || type === "time_and_before") {
				res.type = "time";
				res.get_value_handle = options.get_value_handle;
				if (typeof options.time === "string" && options.time == parseInt(options.time)) {
					options.time = parseInt(options.time);
				}
				if (typeof options.time !== "number") {
					throw new TypeError("typeof time should be number");
				};
				var _mm_time = options.time;
				res.time = function(_update_cache) {
					setTimeout(_update_cache, _mm_time);
				}
			}
			if (type === "b" || type === "bofore" || type === "tb" || type === "time_and_before") {
				res.type = "bofore";
				res.get_value_handle = options.get_value_handle;
				if (typeof options.before_get_value_handle !== "function") {
					throw new TypeError("typeof before_get_value_handle should be function");
				}
				res.before_get_value_handle = options.before_get_value_handle;
			}
			if (type === "tb" || type === "time_and_before") {
				res.type = "time_and_before";
			}
		}
		cache.setCache(_clock_key, res);
	},
	hasClockCache: function(key) {
		var _clock_key = _clock_cahce_prefix_ + key;
		var res = cache.getCache(_clock_key);
		return !!res;
	},
	getClockCache: function(key, return_cb) {
		var _clock_key = _clock_cahce_prefix_ + key;
		var res = cache.getCache(_clock_key);
		if (!res) {
			throw "Clock Cache should be define bofore get";
		}

		function _update_cache(val) {
			res.is_latest = !!arguments.length
			res.value = val;
		};

		function _use_cache() {
			res.debug && res.debug("[ CC   ] Use Cache => ".colorsHead() + key + "\n");
			var val = res.value;
			process.nextTick(function() {
				return_cb(val);
			});
		};

		function _wrap_return_cb(val) {
			res.debug && res.debug("[ CC   ] Mod Cache => ".colorsHead() + key + "\n");
			res.is_latest = true
			res.value = val;
			process.nextTick(function() { //确保统一的异步行为
				return_cb(val);
			});
		};
		switch (res.type) {
			case "normal":
				if (res.is_latest) {
					_use_cache()
				} else {
					res.get_value_handle(_wrap_return_cb, _update_cache);
				}
				break;
			case "time":
				if (res.is_latest) {
					_use_cache();
				} else {
					res.get_value_handle(function(val) {
						_wrap_return_cb(val);
						res.time(_update_cache);
					}, _update_cache);
				}
				break;
			case "bofore":
				res.before_get_value_handle(_update_cache, function() {
					if (res.is_latest) {
						_use_cache();
					} else {
						res.get_value_handle(_wrap_return_cb, _update_cache);
					}
				});
				break;
			case "time_and_before":

				if (res.is_latest) {
					_use_cache();
				} else {
					res.before_get_value_handle(_update_cache, function() {
						if (res.is_latest) {
							_use_cache();
						} else {
							res.get_value_handle(function(val) {
								_wrap_return_cb(val);
								//定时清除缓存
								res.time(_update_cache);
							}, _update_cache);
						}
					});
				}
		}


	}
};
module.exports = cache;

/*TEST*/

// console.time("lstatSync")
// for (var i = 0; i < 10000; i += 1) {
// 	fs.lstatSync(__dirname + "/../tests/www/template.html");
// }
// console.timeEnd("lstatSync")
// console.time("readFileSync")
// for (var i = 0; i < 10000; i += 1) {
// 	fs.readFileSync(__dirname + "/../tests/www/template.html").toString();
// }
// console.timeEnd("readFileSync");

// console.time("getFileCacheContent")
// for (var i = 0; i < 1000000; i += 1) {
// 	cache.getFileCacheContent(__dirname + "/../tests/www/template.html");
// }
// console.timeEnd("getFileCacheContent");



// fs.watchFile("../tests/www/template.html", function(curr, prev) {
// 	console.log('the current mtime is: ' + curr.mtime);
// 	console.log('the previous mtime was: ' + prev.mtime);
// });

function test_clock_cache_1() {
	var test_v = 0
	cache.defineClockCache("test", "normal", {
		get_value_handle: function(return_cb, _update_cache) {
			return_cb(test_v);
			setTimeout(function() {
				test_v += 1;
				_update_cache(test_v);
			}, 1000);
		}
	});


	var i = 0;
	var _ti = setInterval(function() {
		i += 1;
		cache.getClockCache("test", function(v) {
			console.log(v)
		});
		if (i == 5) {
			clearInterval(_ti);
		}
	}, 401);
};

function test_clock_cache_2() {
	var test_v = 0
	cache.defineClockCache("test", "time", {
		get_value_handle: function(return_cb, _update_cache) {
			return_cb(test_v++);
		},
		time: 1000
	});

	var i = 0;
	var _ti = setInterval(function() {
		i += 1;
		cache.getClockCache("test", function(v) {
			console.log(v)
		});
		if (i == 5) {
			clearInterval(_ti);
		}
	}, 401);
};

function test_clock_cache_3() {
	var test_v = 0
	cache.defineClockCache("test", "bofore", {
		get_value_handle: function(return_cb, _update_cache) {
			return_cb(test_v);
			test_v += 1;
		},
		before_get_value_handle: function(_update_cache, next) {
			console.log("run bofore every time!");
			if (i == 3) {
				_update_cache();
			}
			next();
		}
	});

	var i = 0;
	var _ti = setInterval(function() {
		i += 1;
		cache.getClockCache("test", function(v) {
			console.log(v)
		});
		if (i == 5) {
			clearInterval(_ti);
		}
	}, 401);
};

function test_clock_cache_4() {
	var test_v = 0
	cache.defineClockCache("test", "time_and_before", {
		get_value_handle: function(return_cb, _update_cache) {
			return_cb(test_v);
			test_v += 1;
		},
		before_get_value_handle: function(_update_cache, next) {
			console.log("run bofore after time");
			_update_cache();
			next();
		},
		time: 1000
	});

	var i = 0;
	var _ti = setInterval(function() {
		i += 1;
		cache.getClockCache("test", function(v) {
			console.log(v)
		});
		if (i == 5) {
			clearInterval(_ti);
		}
	}, 401);
};



// test_clock_cache_1(); //OK
// test_clock_cache_2(); //OK
// test_clock_cache_3(); //OK
// test_clock_cache_4(); //OK