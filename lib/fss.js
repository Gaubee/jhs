var fs = require("fs");
var fss = Object.create(fs);
var http = require("http");
var vm = require("vm");
var jhs = require("../index");
var path = require("path");
var url = require("url");
var domain = require("domain");
var vm_domain = domain.create();
vm_domain.on("error", function(e) {
	console.error("[ RUBCODE:ERROR ]".colorsHead())
	console.error(e.stack ? e.stack : e);
});

function _normalize(path_or_url) {
	if (/^http\:\/\/|^https\:\/\//.test(url)) {
		return url.format(path_or_url)
	} else {
		return path.normalize(path_or_url)
	}
};

fss.existsSync = function(file_paths) {
	if (Array.isArray(file_paths)) {
		return file_paths.some(function(filepath) {
			return fss.existsSync(filepath)
		});
	} else {
		if (file_paths.indexOf("http") == 0) {
			var fiber = Fiber.current;
			var req = http.get(file_paths, function(res) {
				req.abort();
				fiber.run(res.statusCode != 404);
			});
			return Fiber.yield();
		} else {
			return fs.existsSync(file_paths)
		}
	}
};
fss.existsFileInPathsSync = function(file_paths, filename) {
	return file_paths.some(function(filepath) {
		return fss.existsSync(filepath + "/" + filename)
	});
};
fss.lstatSync = function(file_paths) {
	if (Array.isArray(file_paths)) {
		return file_paths.map(function(filepath) {
			return fss.lstatSync(filepath)
		});
	} else {
		file_paths = _normalize(file_paths);
		var _depends = DEPENDS.get(file_paths);
		console.log("[ GET DEPENDS ]".colorsHead(), file_paths, _depends || []);
		if (_depends && _depends.length) {
			return {
				current: _lstat(file_paths),
				DEPENDS: fss.lstatSync(_depends)
			}
		} else {
			return _lstat(file_paths);
		}
	}
};

function _lstat(filepath) {
	if (filepath.indexOf("http") == 0) {
		var fiber = Fiber.current;
		var req = http.get(filepath, function(res) {
			req.abort();
			fiber.run({
				mtime: res.headers["last-modified"],
				size: res.headers["content-length"]
			});
		});
		return Fiber.yield();
	} else {
		try {
			return fs.lstatSync(filepath)
		} catch (e) { //没有这个文件
			// console.error("lstatSync", e);
			return {}
		}
	}
}

//用来标记找不到文件，寻找下一级目录的指令
var _new_file_placeholder_ = "_NEW_FILE_PLACEHOLDER_" + Math.random().toString(36).substr(2);

/*
 * 与lstatSync配合的情况下，考虑以下情况
 * 1、第一次读取文件，lstatSync判断肯定是要读取文件而不是读取缓存，这时候，读取文件，把依赖读取出来
 * 2、依赖出来后，lstatSync再次运作，就会考虑依赖文件的信息，依赖文件改变就会改变lstatSync的值
 * 3、源文件改变，lstatSync肯定会改变，重新读取文件并读取依赖
 * 4、所以在_mix_file里面就要通过写依赖的方式来解决依赖问题
 * 5、RUNCODE在每一次_mixfile的时候都会运行，所以直接提供接口让RUNCODE把依赖通过接口来注入
 * 6、把注入接口和__INCLUDE接口结合
 */
var DEPENDS = fss.DEPENDS = new Map;

function _mix_file(file_paths, index) {
	index = ~~index;
	var filepath = file_paths[index];
	var res = "";
	if (filepath) {
		filepath = _normalize(filepath);
		//@4
		var _depends = [];
		DEPENDS.set(filepath, _depends);
		var _code_s_reg = String.toRegExp(jhs.options.code_start_reg || /\>{4}/);
		var _code_e_reg = String.toRegExp(jhs.options.code_end_reg || /\<{4}/);
		var _code_s_str = _code_s_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")
		var _code_e_str = _code_e_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")

		var _code_reg = new RegExp(_code_s_str + "([\\s\\S]+?)" + _code_e_str, "g");
		// console.log(_code_reg)
		//同一个文件共享同一个全局变量作用域
		var sandbox = {
			Fiber: Fiber,
			OPTIONS: jhs.options.$clone(),
			require: require,
			arguments: [],//TODO 在IMPORT、SUPER中实现参数
			console: console,
			__filename: path.basename(filepath),
			__dirname: path.normalize(filepath),
			get __SUPER() {
				return jhs.cache.getFileCacheContent(file_paths.slice(index + 1))
			},
			IMPORT: function(filepath) {
				var paths = jhs.getOptionsRoot().map(function(folder_path) {
					//TODO:考虑HTTP协议
					return path.normalize(folder_path + "/" + filepath)
				});
				//@6
				_depends.push.apply(_depends, paths);

				return jhs.cache.getFileCacheContent(paths);
			}
		};
		vm.createContext(sandbox);
		res = fss.readFileSync(filepath)
			.replace(_new_file_placeholder_, function() {
				return _mix_file(file_paths, index + 1)
			})
			.replace(_code_reg, function(match_str, code) {
				// console.log("RUN CODE:", code);
				code = "(function(){" + code + "}).apply(this, arguments)";

				return vm_domain.run(() => {
					return vm.runInContext(code, sandbox);
				}) || "";
			});

		console.log("[ SET DEPENDS ]".colorsHead(), filepath, _depends)
	}
	return res;
};
fss.readFileSync = function function_name(file_paths) {
	if (Array.isArray(file_paths)) {
		return _mix_file(file_paths)
	} else {
		var result;
		if (file_paths.indexOf("http://") == 0) {
			var fiber = Fiber.current;
			var req = http.get(file_paths, function(res) {
				if (res.statusCode == 404) {
					fiber.run(_new_file_placeholder_);
				} else {
					var result = "";
					res.on("data", function(chunk) {
						result += chunk;
					}).on("end", function() {
						fiber.run(result.toString());
					});
				}
			});
			result = Fiber.yield();
		} else {
			try {
				result = fs.readFileSync(file_paths).toString()
			} catch (e) {
				// console.error("readFileSync", e);
				result = _new_file_placeholder_;
			}
		}
		//执行模板中的代码
		return result;
	}
}
module.exports = fss;