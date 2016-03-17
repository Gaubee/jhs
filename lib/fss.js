const fs = require("fs");
const fss = Object.create(fs);
module.exports = fss;

const http = require("http");
const vm = require("vm");
const jhs = require("../index");
const filetype = require("./filetype");
const temp = require("./temp");
const path = require("path");
const url = require("url");
const isHTTPUrl = (url) => /^http\:\/\/|^https\:\/\//.test(url);

function _normalize(path_or_url) {
	if (isHTTPUrl(path_or_url)) {
		const url_info = url.parse(url.format(path_or_url));
		url_info.pathname = url_info.pathname.replace(/\/{2,}/g, "/");
		console.log(url_info)
		return url.format(url_info);
	} else {
		return path.normalize(path_or_url)
	}
};

fss.existsMutilAsync = co.wrap(function*(file_paths) {
	if (Array.isArray(file_paths)) {
		const res_arr = yield file_paths.map(filepath => fss.existsMutilAsync(filepath));
		return res_arr.some(res => res);
	} else {
		if (isHTTPUrl(file_paths)) {
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
					resolve(!err);
				});
			});
		}
	}
});
fss.existsAsync = function(filepath) {
	return Promise.try((resolve, reject) => {
		fs.lstat(filepath, (err, res) => {
			resolve(!err);
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
		const file_path = _normalize(file_paths);
		const _depends = DEPENDS.get(file_path);
		if (_depends && _depends.length) {
			const res = {
				current: _lstat(file_path),
				DEPENDS: yield fss.lstatMutilAsync(_depends)
			};
			return res;
		} else {
			return yield _lstat(file_path);
		}
	}
});

function _lstat(filepath) {
	if (isHTTPUrl(filepath)) {
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

fss.readFileAsync = function(filepath) {
	return Promise.try((resolve, reject) => {
		fs.readFile(filepath, (err, res) => {
			err ? reject(err) : resolve(res);
		});
	});
};

fss.writeFileAsync = function(filepath, content) {
	return Promise.try((resolve, reject) => {
		fs.writeFile(filepath, content, (err, res) => {
			err ? reject(err) : resolve(res);
		});
	});
};

fss.getReadAbleStream = function(filepath) {
	return Promise.try((resolve, reject) => {
		const st = fss.createReadStream(filepath);
		st.on("error", reject);
		st.on("readable", () => resolve(st));
	});
};
fss.getReadAbleStreamFromUrl = function(html_url) {
	return Promise.try((resolve, reject) => {
		const req = http.get(html_url, function(res) {
			if (res.statusCode == 404) {
				reject(res.statusCode);
			} else {
				resolve(res);
			}
		});
		req.on("error", reject);
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
 
 * 补充
 * 这个函数的调用之前，必须先有existsFileInPathsMutilAsync判定过肯定最后有结果，所以开始调用
 * 所以在执行过程中，不用考虑最后的404情况
 */
var DEPENDS = fss.DEPENDS = new Map;
fss.addDepens = (path, dep) => {
	path = _normalize(path);
	dep = _normalize(dep);
	const deps = DEPENDS.get(path) || [];
	if (deps.indexOf(dep) === -1) {
		deps.push(dep);
		DEPENDS.set(path, deps);
	}
};

fss.readFileMutilAsync = function(file_paths, return_er, jhs_options) {
	if (!Array.isArray(file_paths)) {
		file_paths = [file_paths]
	}
	return _mix_file(file_paths, 0, return_er, jhs_options)
};

//获取一个文件类型所需要的最大文件头
const file_type_need_size = (() => {
	return fs.readFileSync(__dirname + "/filetype.js").toString().match(/buf\[(\d+?)\]/g).reduce((res, str) => {
		return Math.max(res, parseInt(str.substr(4, str.length - 2)))
	}, 0);
}());

const _mix_file = co.wrap(function*(file_paths, index, return_er, jhs_options) {

	jhs_options || (jhs_options = jhs.options);
	index = ~~index;
	var filepath = file_paths[index];
	var res_str = ""; // 文本类型的存储区，最好不要改变JS对象的类型，以提升效率
	// 如果已经越级，直接返回空对象
	if (index >= file_paths.length) {
		return res_str;
	}

	// 格式化路径为标准的路径
	filepath = _normalize(filepath);
	/*
	 * 空路径，或者空文件，直接返回下一级的文件
	 */
	if (!filepath) {
		return _mix_file(file_paths, index + 1, return_er, jhs_options)
	}
	const res_st = yield _createStream(filepath, return_er, jhs_options);
	if (res_st === _new_file_placeholder_) {
		return _mix_file(file_paths, index + 1, return_er, jhs_options)
	}

	if (return_er.is_url = isHTTPUrl(filepath)) {
		const http_content_type = res_st.headers["content-type"]
		var _file_type_info = (
			http_content_type.startWith("text") ||
			http_content_type.startWith("application/javascript")
		) ? null : {
			mime: http_content_type
		};

		/*
		 * 获取相对目录信息
		 */
		Object.defineProperty(return_er, "_folderpath_without_root", {
			configurable: true,
			get: () => {
				// 获取目录
				const _f = filepath.substr(0, filepath.lastIndexOf("/"));
				// 获取跟
				const _r = jhs_options.root[index];
				// 获取相对目录
				const _f_no_r = _f.substr(_r.length);

				Object.defineProperty(return_er, "_folderpath_without_root", {
					value: _f_no_r
				});
				return _f_no_r;
			}
		});

	} else {
		// 以最小代价获取文件类型
		const type_buff = res_st.read(file_type_need_size);
		res_st.unshift(type_buff); // 取到所需的文件头后就把拼回去，确保stream的完整可用
		var _file_type_info = filetype(type_buff);

		/*
		 * 获取相对目录信息
		 */
		Object.defineProperty(return_er, "_folderpath_without_root", {
			configurable: true,
			get: () => {
				// 获取目录
				const _f = filepath.substr(0, filepath.length - path.basename(filepath));
				// 获取跟
				const _r = path.normalize(jhs_options.root[index]);
				// 获取相对目录
				const _f_no_r = _f.substr(_r.length);

				Object.defineProperty(return_er, "_folderpath_without_root", {
					value: _f_no_r
				});
				return _f_no_r;
			}
		});

	}

	// 文本类型的file_type为null
	if (!_file_type_info) {
		//文本类型的文件直接读出Buffer
		return_er.is_text = true;
		//@4
		var sandbox;
		const _code_s_reg = String.toRegExp(jhs_options.code_start_reg || /\`\$\{/);
		const _code_e_reg = String.toRegExp(jhs_options.code_end_reg || /\}\`/);
		const _code_s_str = _code_s_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")
		const _code_e_str = _code_e_reg.toString().replace(/^\/([\s\S]+)\/[\i\g]*/, "$1")
		const _code_reg = new RegExp(_code_s_str + "([\\s\\S]+?)" + _code_e_str, "g");

		const _init_sandbox = () => {
			const _depends = [];
			DEPENDS.set(filepath, _depends);

			//同一个文件共享同一个全局变量作用域
			sandbox = {
				OPTIONS: jhs_options.$clone(),
				// require: require,
				arguments: [], //TODO 在IMPORT、SUPER中实现参数
				console: console,
				get __filename() {
					if (return_er.is_url) {
						var pathname = url.parse(filepath).pathname;
						var res = pathname.substr(pathname.lastIndexOf("/") + 1);
					} else {
						res = path.basename(filepath);
					}
					Object.defineProperty(this, "__filename", { value: res });
					return res;
				},
				get __dirname() {
					if (return_er.is_url) {
						var url_info = url.parse(filepath);
						url_info.pathname = url_info.pathname.substr(0, url_info.pathname.lastIndexOf("/"))
						res = url.format(url_info);
					} else {
						res = path.parse(filepath).dir
					}
					Object.defineProperty(this, "__dirname", { value: res });
					return res;
				},
				get __SUPER() {
					return jhs.cache.getFileCacheContent(file_paths.slice(index + 1), jhs_options)
				},
				IMPORT: function _IMPORT(import_filepath, _sep) {
					if (Array.isArray(import_filepath)) {
						typeof _sep === "string" || (_sep = "\r\n");
						return Promise.all(import_filepath.map(_filepath => _IMPORT(_filepath))).then(res => res.join(_sep));
					}
					const root = jhs_options.root;
					Array.isArray(root) || (root = [root]);

					/*
					 * 开始新一轮的_mix_file，需要重新计算层级
					 * filepath：
					 * 需要考虑HTTP模块
					 * 考虑绝对路径模块
					 * 剩下的当作相对路径模块来搞，使用join
					 
					 * root：
					 * 如果是HTTP协议的root，那么所有模块都HTTP化，filepath为HTTP时，不改变filepath

					 * 所以如果filepath为HTTP协议，那么不变，可直接优化为一层
					 */
					var _f_no_r;
					if (isHTTPUrl(import_filepath)) {
						var paths = [import_filepath]
					} else {
						paths = root.map(function(folder_path) {
							if (isHTTPUrl(folder_path)) {
								return url.resolve(folder_path, import_filepath);
							} else if (path.isAbsolute(import_filepath)) {
								return path.join(folder_path, import_filepath); // 绝对路径，以Root为起点
							} else { // 相对路径，以当前文件的文件夹为起点

								return path.normalize(folder_path + path.sep +
									return_er._folderpath_without_root + path.sep +
									import_filepath);
							}
						});
					}
					//@6
					console.log(paths)
					_depends.push.apply(_depends, paths);

					return _mix_file(paths, 0, {}, jhs_options).then(import_file => import_file.getReadAbleStream().then(stream => Promise.readStream(stream)));
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
			return sandbox;
		};

		var _should_yield = false; // 异步的模块是否返回的是一个Promise，如果是，等待这些函数执行完最后统一合并
		const _yield_placeholer = []; // 异步编译块的占位符
		const _yield_obj = []; // 异步编译块的Promise对象
		res_str = (yield Promise.readStream(res_st)).toString() // 将流中的数据读取到内存中的字符串，执行编译
			.replace(_code_reg, function(match_str, code) {
				code = "(function(){" + code + "}).apply(this, arguments)";
				// console.log("RUN CODE:", code);

				try {
					const run_res = vm.runInContext(code, sandbox || _init_sandbox());
					// 可能是Promise对象，代表异步编译模块
					if (run_res instanceof Promise) {
						_should_yield = true;
						const run_res_placeholder = $$.uuid("YIELD_PLACEHOLDER");
						_yield_placeholer.push(run_res_placeholder);
						_yield_obj.push(run_res);
						return run_res_placeholder;
					} else {
						return run_res /*undefined||null*/ == undefined ? "" : run_res;
					}
				} catch (e) {
					return String(e.stack || e);
				}
			});


		if (_should_yield) {
			const _yield_obj_res = yield _yield_obj;
			_yield_obj_res.forEach((v, i) => {
				res_str = res_str.replace(_yield_placeholer[i], () => _yield_obj_res[i] /*使用函数替换，避免$带来的问题*/ );
			});
		}
		// 写入到缓冲区中
		yield temp.set(return_er.temp_namespace = "fss_build_res",
			return_er.temp_key = $$.md5_2(res_str, return_er.filepath),
			res_str);

		return_er.getReadAbleStream = () => temp.getStream(return_er.temp_namespace, return_er.temp_key);
	} else {
		// 非文本类型的文件读出Stream
		return_er.is_text = false;
		return_er.getReadAbleStream = return_er.is_url ?
			() => fss.getReadAbleStreamFromUrl(return_er.filepath) :
			() => fss.getReadAbleStream(return_er.filepath);
	}
	return return_er;
});

function _createStream(filepath, return_er, jhs_options) {
	if (isHTTPUrl(filepath)) {
		return Promise.try((resolve, reject) => {
			const req = http.get(filepath, function(res) {
				if (res.statusCode == 404) {
					resolve(_new_file_placeholder_);
				} else {
					return_er.filepath = filepath;
					resolve(res);
				}
			});
			req.on("error", () => resolve(_new_file_placeholder_));
		});
	} else {
		return Promise.try((resolve, reject) => {
			const st = fs.createReadStream(filepath);
			st.on("error", () => resolve(_new_file_placeholder_));
			st.on("readable", () => {
				return_er.filepath = filepath;
				resolve(st)
			});
		});
	}
};
