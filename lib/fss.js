const fs = require("fs");
const fss = Object.create(fs);
const http = require("http");
const vm = require("vm");
const jhs = require("../index");
const filetype = require("./filetype");
const path = require("path");
const url = require("url");

function _normalize(path_or_url) {
	if (/^http\:\/\/|^https\:\/\//.test(url)) {
		return url.format(path_or_url)
	} else {
		return path.normalize(path_or_url)
	}
};

fss.existsMutilAsync = co.wrap(function*(file_paths) {
	if (Array.isArray(file_paths)) {
		const res_arr = yield file_paths.map(filepath => fss.existsMutilAsync(filepath));
		return res_arr.some(res => res);
	} else {
		if (file_paths.indexOf("http://") === 0 || file_paths.indexOf("https://") == 0) {
			return Promise.try((resolve, reject) => {
				const req = http.get(file_paths, function(res) {
					req.abort();
					resolve(res.statusCode != 404);
				});
				req.on("error", () => resolve(false));
			});
		} else {
			return Promise.try((resolve, reject) => {
				fs.lstat(file_paths, (err, res) => {
					err ? resolve(false) : resolve(true)
				});
			});
		}
	}
});
fss.existsAsync = function(filepath) {
	return Promise.try((resolve, reject) => {
		fs.lstat(filepath, (err, res) => {
			err ? reject(err) : resolve(true)
		});
	});
};
fss.existsFileInPathsMutilAsync = function(file_paths, filename) {
	return fss.existsMutilAsync(file_paths.slice().map(filepath => filepath + "/" + filename));
};
fss.lstatMutilAsync = co.wrap(function*(file_paths) {
	if (Array.isArray(file_paths)) {
		const res_arr = yield file_paths.map(filepath => fss.lstatMutilAsync(filepath));
		return yield file_paths.map(function(filepath) {
			return fss.lstatMutilAsync(filepath)
		});
	} else {
		file_paths = _normalize(file_paths);
		var _depends = DEPENDS.get(file_paths);
		// console.log("[ GET DEPENDS ]".colorsHead(), file_paths, _depends || []);
		if (_depends && _depends.length) {
			return {
				current: _lstat(file_paths),
				DEPENDS: fss.lstatMutilAsync(_depends)
			};
		} else {
			return yield _lstat(file_paths);
		}
	}
});

function _lstat(filepath) {
	if (filepath.indexOf("http://") === 0 || filepath.indexOf("https://") == 0) {
		return Promise.try((resolve, reject) => {
			const req = http.get(filepath, function(res) {
				req.abort();
				resolve(res.statusCode !== 404 && {
					mtime: res.headers["last-modified"],
					size: res.headers["content-length"]
				});
			});
			req.on("error", reject);
		});
	} else {
		return Promise.try((resolve, reject) => {
			fs.lstat(filepath, (err, res) => {
				resolve(res); // err ? resolve(null) : resolve(res)
			});
		});
	}
};

fss.lstatAsync = function(filepath) {
	return Promise.try((resolve, reject) => {
		fs.lstat(filepath, (err, res) => {
			err ? reject(err) : resolve(res)
		});
	});
};

//用来标记找不到文件，寻找下一级目录的指令typeof res === "string"&&
var _new_file_placeholder_ = "_NEW_FILE_PLACEHOLDER_" + Math.random().toString(36).substr(2);

/*
 * 与lstatMutilAsync配合的情况下，考虑以下情况
 * 1、第一次读取文件，lstatMutilAsync判断肯定是要读取文件而不是读取缓存，这时候，读取文件，把依赖读取出来
 * 2、依赖出来后，lstatMutilAsync再次运作，就会考虑依赖文件的信息，依赖文件改变就会改变lstatMutilAsync的值
 * 3、源文件改变，lstatMutilAsync肯定会改变，重新读取文件并读取依赖
 * 4、所以在_mix_file里面就要通过写依赖的方式来解决依赖问题
 * 5、RUNCODE在每一次_mixfile的时候都会运行，所以直接提供接口让RUNCODE把依赖通过接口来注入
 * 6、把注入接口和__INCLUDE接口结合
 */
var DEPENDS = fss.DEPENDS = new Map;

fss.readFileMutilAsync = function(file_paths, return_er, jhs_options) {
	if (Array.isArray(file_paths)) {
		return _mix_file(file_paths, 0, return_er, jhs_options)
	} else {
		return _readFile(file_paths, return_er, jhs_options)
	}
};
fss.readFileAsync = function(filepath) {
	return Promise.try((resolve, reject) => {
		fs.readFile(filepath, (err, res) => {
			err ? reject(err) : resolve(res);
		});
	});
};

fss.writeFileAsync = function(filepath, content) {
	return Promise((resolve, reject) => {
		fs.writeFile(filepath, content, (err, res) => {
			err ? reject(err) : resolve(res);
		});
	});
};

const _mix_file = co.wrap(function*(file_paths, index, return_er, jhs_options) {
	jhs_options || (jhs_options = jhs.options);
	index = ~~index;
	var filepath = file_paths[index];
	var res = "";
	if (filepath) {
		filepath = _normalize(filepath);
		//@4
		const _depends = [];
		DEPENDS.set(filepath, _depends);
		const _code_s_reg = String.toRegExp(jhs_options.code_start_reg || /\>{4}/);
		const _code_e_reg = String.toRegExp(jhs_options.code_end_reg || /\<{4}/);
		const _code_s_str = _code_s_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")
		const _code_e_str = _code_e_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")

		const _code_reg = new RegExp(_code_s_str + "([\\s\\S]+?)" + _code_e_str, "g");
		// console.log(_code_reg)
		//同一个文件共享同一个全局变量作用域
		const sandbox = {
			OPTIONS: jhs_options.$clone(),
			// require: require,
			arguments: [], //TODO 在IMPORT、SUPER中实现参数
			console: console,
			__filename: path.basename(filepath),
			__dirname: path.normalize(filepath),
			get __SUPER() {
				return jhs.cache.getFileCacheContent(file_paths.slice(index + 1), jhs_options)
			},
			IMPORT: function _IMPORT(filepath, _sep) {
				if (Array.isArray(filepath)) {
					typeof _sep === "string" || (_sep = "\r\n");
					return Promise.all(filepath.map(_filepath => _IMPORT(_filepath))).then(res => res.join(_sep));
				}
				var root = jhs_options.root;
				Array.isArray(root) || (root = [root]);

				var paths = root.map(function(folder_path) {
					return _normalize(folder_path + "/" + filepath)
				});
				//@6
				_depends.push.apply(_depends, paths);
				return jhs.cache.getFileCacheContent(paths, jhs_options);
			},
			toBrowserExpore: function BROWSER_DEFINE(exports_name, variable_name, deps) {
				Array.isArray(deps) ? deps = JSON.stringify(deps) : (deps = "[]");

				return `// AMD support
						if (typeof define === 'function' && define.amd) {
							define("${exports_name}",${deps}, function() {
								return ${variable_name} ;
							});
							// CommonJS/Node.js support
						} else if (typeof exports === 'object') {
							if (typeof module === 'object' && typeof module.exports === 'object') {
								exports = module.exports = ${variable_name} ;
							}
							exports.${exports_name} = ${variable_name} ;
						} 
						window.${exports_name} = ${variable_name} ;
						//EXPORT END
						`.replaceAll("						", "");
			}
		};

		vm.createContext(sandbox);
		res = yield _readFile(filepath, return_er);
		var _file_type_info = filetype(res);

		// 文本类型的file_type为null
		if (return_er) {
			if (!_file_type_info) {
				return_er.is_text = true;
				if (typeof res === "string" && res === _new_file_placeholder_) {
					res = yield _mix_file(file_paths, index + 1, return_er, jhs_options);
				} else {
					var _should_yield = false;
					const _yield_placeholer = [];
					const _yield_obj = [];
					res = res.toString()
						.replace(_code_reg, function(match_str, code) {
							code = "(function(){" + code + "}).apply(this, arguments)";
							// console.log("RUN CODE:", code);

							try {
								const res = vm.runInContext(code, sandbox);
								if (res instanceof Promise) {
									_should_yield = true;
									const res_placeholder = $$.uuid("YIELD_PLACEHOLDER");
									_yield_placeholer.push(res_placeholder);
									_yield_obj.push(res);
									return res_placeholder;
								} else {
									return res /*undefined||null*/ == undefined ? "" : res;
								}
							} catch (e) {
								return String(e.stack || e);
							}
						});

					// debugger;
					console.log("_should_yield:", _should_yield)
					if (_should_yield) {
						console.flag("_yield_placeholer:", _yield_placeholer);
						var _yield_obj_res = yield _yield_obj;
						_yield_obj_res.forEach((v, i) => {
							res = res.replace(_yield_placeholer[i], () => _yield_obj_res[i]/*使用函数替换，避免$带来的问题*/);
						});

					}
				}
			} else {
				return_er.is_text = false;
			}
		}

		// console.log("[ SET DEPENDS ]".colorsHead(), filepath, _depends)
	}

	return res;
});

function _readFile(filepath, return_er, jhs_options) {
	if (filepath.indexOf("http://") === 0 || filepath.indexOf("https://") == 0) {
		return Promise.try((resolve, reject) => {
			const req = http.get(filepath, function(res) {
				if (res.statusCode == 404) {
					resolve(_new_file_placeholder_);
				} else {
					var chunks = [];
					return_er && (return_er.filepath = filepath);
					res.on("data", function(chunk) {
						chunks.push(chunk);
					}).on("end", function() {
						resolve(Buffer.concat(chunks));
					});
				}
			});
			req.on("error", () => resolve(_new_file_placeholder_));
		});
	} else {
		return_er && (return_er.filepath = filepath);
		return Promise.try((resolve, reject) => {
			fs.readFile(filepath, (err, res) => {
				resolve(err ? _new_file_placeholder_ : res);
			});
		});
	}
};
module.exports = fss;