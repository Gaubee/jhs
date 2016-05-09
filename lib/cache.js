const cacheMap = {};
const fss = require("./fss");
const filetype = require("./filetype");
const temp = require("./temp");
const _file_cahce_prefix_ = Math.random().toString(32).substr(2) + ":";
const _clock_cahce_prefix_ = Math.random().toString(32).substr(2) + ":";
const crypto = require('crypto');

function format_state(state) {
	return JSON.stringify(state);
};

function equal_state(state_1, state_2) {
	return state_1 === state_2;
};
var delay_time = Object.create(null);
const file_md5_symbol = Symbol("file_md5");
const cache = {
	cache: cacheMap,
	options: {
		file_cache_time: 2000
	},
	getCache: (key) => {
		return cacheMap[key];
	},
	buildCache: (key, default_value) => {
		return cacheMap[key] || (cacheMap[key] = default_value);
	},
	setCache: (key, value) => {
		return (cacheMap[key] = value);
	},
	delaySetCache: (key, value, time) => {
		setTimeout(() => {
			cacheMap[key] = value
		}, time);
		return value;
	},
	setTimeDelaySetCache: (key, value, time) => {
		if (!delay_time[key]) {
			delay_time[key] = setTimeout(() => {
				cacheMap[key] = value
			}, time);
		}
		return delay_time[key];
	},
	clearTimeDelaySetCache: (key) => {
		clearTimeout(delay_time[key])
	},
	removeCache: (key) => {
		return cache.setCache(key, void 0);
	},

	//原理：@Gaubee [高效文件缓存机制的实现](https://github.com/Gaubee/blog/issues/81)
	//现在使用ClockCache进行实现
	getFileCache: co.wrap(function*(pathname, time_out, jhs_options) {
		Array.isArray(pathname) || (pathname = [pathname]);
		const file_key = _file_cahce_prefix_ + pathname;
		if (!cache.hasClockCache(file_key)) {
			var pre_state = {};
			cache.defineClockCache(file_key, "time_and_before", {
				get_value_handle: co.wrap(function*(return_cb, _update_cache, reject) {
					console.flag(" file:read ", "=>", pathname);
					const file_cache = {
						get source_md5() { //返回Promise对象
							if (this[file_md5_symbol]) {
								return Promise.resolve(this[file_md5_symbol])
							} else {
								return Promise.try((resolve, reject) => {
									const sum = crypto.createHash('md5');
									// 用新的流对象来处理
									file_cache.getReadAbleStream().then((file_stream) => {
										file_stream.on('data', function(chunk) {
											try {
												sum.update(chunk)
											} catch (err) {
												reject(err)
											}
										});
										file_stream.on('end', function() {
											return resolve(sum.digest('hex'))
										});
									}).catch(reject);
								});
							}
						},
						get source_stream() { //返回Promise对象
							return file_cache.getReadAbleStream();
						}
					};
					// 读取并执行文件脚本最后得出的内容
					if ("" === (yield fss.readFileMutilAsync(pathname, file_cache, jhs_options))) {
						reject(Error("No Found:" + pathname));
					}
					// 传入的file_cache
					return_cb(file_cache);
				}, (err, return_cb, _update_cache, reject) => reject(err)),
				before_get_value_handle: co.wrap(function*(_update_cache, next) {
					const current_state = format_state(yield fss.lstatMutilAsync(pathname));
					const _flag_head = "[ file:check ]".colorsHead();
					console.group(_flag_head, "=>", pathname);
					// if (this.is_timeout) //must be true
					console.log("文件缓存超时，重新检测缓存可用性");
					if (!equal_state(current_state, pre_state)) {
						if (this.is_latest) {
							console.log("文件已经被修改，缓存无效");
						} else {
							console.log("初始化文件缓存");
						}
						pre_state = current_state;
						_update_cache();
					} else {
						console.log("文件未被修改，继续使用文件缓存");
						_update_cache(cache.NO_UPDATE_CLOCKCACHE);
					}
					console.groupEnd(_flag_head, "\n");
					next();
				}),
				time: parseInt(time_out) || cache.options.file_cache_time,
				// debug: true
			}, (err, _update_cache, next) => next(err));
		}

		return yield Promise.try((resolve, reject) => {
			cache.getClockCache(file_key, (file_cache) => {
				resolve(file_cache);
			}, reject);
		});
	}),
	getFileCacheContent: function(pathname, jhs_options) {
		return cache.getFileCache(pathname, cache.options.file_cache_time, jhs_options)
			.then(cache => cache.source_stream);
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
	 *    要求参数 : get_value_handle(return_cb, _update_cache, reject)
	 *               time
	 *               before_get_value_handle(_update_cache, then)
	 */
	defineClockCache: function(key, type, options) {
		options || (options = {});
		var _clock_key = _clock_cahce_prefix_ + key;
		var res = {
			key: key,
			debug: options.debug ? console.log : $$.noop,
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
				//是否在时间到的时候清除缓存，默认FALSE。
				res.clear_cache_when_time_out = !!options.clear_cache_when_time_out;

				if (typeof options.time === "string" && options.time == parseInt(options.time)) {
					options.time = parseInt(options.time);
				}
				if (typeof options.time !== "number") {
					throw new TypeError("typeof time should be number");
				};
				var _mm_time = options.time;
				var _time_fun = (typeof options.time_fun === "function") && options.time_fun;

				res.time = function _time_core(_update_cache) {
					res.is_timeout = false;
					res.time = $$.noop; // 换掉time函数，确保在Timeout的时间段里面不会重新触发
					if (_time_fun) {
						var self = this;
						var args = Array.prototype.slice.call(arguments);
						_update_cache = function() {
							return _time_fun.apply(this, args);
						}
					}
					setTimeout(function() {
						res.time = _time_core;
						_update_cache(res.clear_cache_when_time_out ? (void 0) : cache.TIMEOUT_CLOCKCACHE);
					}, _mm_time);
				};
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
	hasClockCache: (key) => {
		var _clock_key = _clock_cahce_prefix_ + key;
		var res = cache.getCache(_clock_key);
		return !!res;
	},
	NO_UPDATE_CLOCKCACHE: {},
	TIMEOUT_CLOCKCACHE: {},
	getClockCache: co.wrap(function*(key, return_cb, error_cb) {
		const _clock_key = _clock_cahce_prefix_ + key;
		const res = cache.getCache(_clock_key);

		if (!res) {
			throw "Clock Cache should be define bofore get";
		}

		function _update_cache(val) {
			if (val === cache.NO_UPDATE_CLOCKCACHE) {
				return;
			}
			if (val === cache.TIMEOUT_CLOCKCACHE) {
				res.is_timeout = true;
				return;
			}
			res.is_latest = !!arguments.length
			res.value = val;
		};

		function _use_cache() {
			res.debug && res.debug("[ CC   ] Use Cache => ".colorsHead() + key + "\n");
			var val = res.value;
			return_cb(val);
		};

		function _wrap_return_cb(val, err) {
			if (err) {
				return error_cb(err);
			}
			res.debug && res.debug("[ CC   ] Mod Cache => ".colorsHead() + key + "\n");
			res.is_latest = true
			res.value = val;
			return_cb(val);
		};
		switch (res.type) {
			case "normal":
				if (res.is_latest) {
					_use_cache()
				} else {
					res.get_value_handle(_wrap_return_cb, _update_cache, error_cb);
				}
				break;
			case "time":
				if (!res.is_timeout && res.is_latest) {
					_use_cache();
				} else {
					res.get_value_handle(_wrap_return_cb, _update_cache, error_cb);
				}
				//定时清除缓存
				res.time(_update_cache);
				break;
			case "bofore":
				res.before_get_value_handle(_update_cache, function(err) {
					if (err) {
						return error_cb(err);
					}
					if (res.is_latest) {
						_use_cache();
					} else {
						res.get_value_handle(_wrap_return_cb, _update_cache, error_cb);
					}
				});
				break;
			case "time_and_before":
				if (!res.is_timeout && res.is_latest) {
					_use_cache();
				} else {
					res.before_get_value_handle(_update_cache, function(err) {
						if (err) {
							return error_cb(err);
						}
						if (res.is_latest) {
							_use_cache();
						} else {
							res.get_value_handle(_wrap_return_cb, _update_cache, error_cb);
						}
					});
				}
				//定时清除缓存
				res.time(_update_cache);
		}
	})
};
module.exports = cache;