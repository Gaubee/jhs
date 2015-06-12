var cacheMap = {};
var path = require("path");
var fs = require("fs");
var _file_content_cahce_prefix_ = Math.random().toString() + ":";
var _file_state_cahce_prefix_ = Math.random().toString() + ":";

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
var cache = {
	cache: cacheMap,
	options: {
		file_cache_time: 500
	},
	getCache: function(key) {
		return cacheMap[key];
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
	removeCache: function(key) {
		return cache.setCache(key, void 0);
	},
	getFileCache: function(pathname) {//@Gaubee [高效文件缓存机制的实现](https://github.com/Gaubee/blog/issues/81)
		pathname = path.normalize(pathname);
		var content_key = _file_content_cahce_prefix_ + pathname;
		var state_key = _file_state_cahce_prefix_ + pathname;
		//文件如果发生改变，移除缓存
		var old_state = cache.getCache(state_key);
		/*
		 * 如果有缓存的 文件信息 ，则说明上一次访问这个文件的时间超过了file_cache_time，这时候重新校验文件信息
		 */
		if (old_state) {
			var new_state = format_state(fs.lstatSync(pathname));
			//不论校验结果，都移除这个文件信息
			cache.removeCache(state_key);
			//如果文件改变了，缓存清除，文件会被重新读取，文件信息会在file_cache_time后重新写入供给检查
			if (!equal_state(new_state, old_state)) {
				cache.removeCache(content_key);
			} else { //如果文件没有变，清除文件信息，并在file_cache_time后重写
				cache.delaySetCache(state_key, new_state, cache.options.file_cache_time);
			}
		}
		var value = cache.getCache(content_key);
		if (!value) {
			value = cache.setCache(content_key, fs.readFileSync(pathname));
			//0.5s后才将这个state值写入缓存中，这样能确保这个文件缓存至少能够使用0.5s
			cache.delaySetCache(state_key, new_state || format_state(fs.lstatSync(pathname)), cache.options.file_cache_time);
		}
		return value;
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

// console.time("getFileCache")
// for (var i = 0; i < 1000000; i += 1) {
// 	cache.getFileCache(__dirname + "/../tests/www/template.html");
// }
// console.timeEnd("getFileCache");



// fs.watchFile("../tests/www/template.html", function(curr, prev) {
// 	console.log('the current mtime is: ' + curr.mtime);
// 	console.log('the previous mtime was: ' + prev.mtime);
// });