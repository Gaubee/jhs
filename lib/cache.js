var cacheMap = {};
var path = require("path");
var fs = require("fs");
var filetype = require("./filetype");
var _file_cahce_prefix_ = Math.random().toString() + ":";

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
var delay_timer = Object.create(null);
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
	delaySetCache: function(key, value, timer) {
		setTimeout(function() {
			cacheMap[key] = value
		}, timer);
		return value;
	},
	setTimeDelaySetCache: function(key, value, timer) {
		if (!delay_timer[key]) {
			delay_timer[key] =
				setTimeout(function() {
					cacheMap[key] = value
				}, timer);
		}
		return delay_timer[key];
	},
	clearTimeDelaySetCache: function(key) {
		clearTimeout(delay_timer[key])
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
			console.log(pathname, "filetype:", filetype(file_cache.source_content));
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