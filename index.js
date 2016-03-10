"use strict";
require("gq-core");
const express = require("express");
const jhs = express();
module.exports = jhs;
const compression = require('compression');
const filter = require("./lib/filter");
const cache = require("./lib/cache"); // 用来读取文件内容
const temp = require("./lib/temp"); // 用来获取、创建缓冲区文件
const fss = require("./lib/fss"); // 在这里用来判断文件 存在与否
const path = require("path");
const tld = require("tldjs");
const TypeScriptSimple = require('typescript-simple').TypeScriptSimple;
// const BabelCore = require("babel-core");
const sass = require('node-sass');
const less = require('less');
const CleanCSS = require('clean-css');
const UglifyJS = require("uglify-js");
const stream = require("stream");
const replaceStream = jhs.replaceStream = require("replacestream");
var _404file;

function _get_404_file() {
	return cache.getFileCacheContent(__dirname + "/lib/404.html");
};
/*
 * 初始化
 */
jhs.use(compression()); // GZIP
jhs.fs = fss;
jhs.cache = cache;
// Object.keys(console.__proto__).forEach(function(method_name) {
// 	var method = console[method_name];
// 	console[method_name] = function() {
// 		if (jhs.options.debug) {
// 			return method.apply(this, arguments);
// 		}
// 	}
// });
/*
 * 配置
 */
jhs.options = {};
jhs.getOptions = function(req) {
	return req.jhs_options || jhs.options;
};
jhs.getOptionsRoot = function(req) {
	var root = jhs.getOptions(req).root || __dirname;
	Array.isArray(root) || (root = [root]);
	return root;
}
jhs.filter = function(path, callback, options) {
	var f = filter.get(path, options);
	f.addHandle(callback);
};
/*
 * 包装的过滤器
 */
jhs.emit_filter = function(path, req, res, then_fun, catch_fun) {
	var extend_args = Array.prototype.slice.call(arguments, 1);
	var _is_match_someone;
	filter.cache.some(function(f) { // 只触发一个匹配路由
		if (f.math(path)) {
			var args = [path, f.params, req, res];
			_is_match_someone = true;
			f.emitHandle.apply(f, args).then(then_fun).catch(catch_fun);
			return true;
		}
	});
	if (!_is_match_someone) {
		console.error("找不到任何路由匹配信息", path);
		res.status(404);
		then_fun instanceof Function && then_fun();
	}
};
/*
 * 可处理Promise的emit
 */
jhs.emitPromise = co.wrap(function*(event_name) {
	const events = jhs._events[event_name];
	if (events) {
		const _flag_head = ("[ EMIT:" + event_name + " ]").colorsHead();
		const _g = console.group(_flag_head);
		const args = Array.slice(arguments, 1);
		if (Array.isArray(events)) {
			yield events.map(handle => handle.apply(this, args));
		} else if (Function.isFunction(events)) {
			const res = events.apply(this, args);
			if (res instanceof Promise) {
				yield res
			}
		}
		console.groupEnd(_g, _flag_head);
	}
});
/*
 * 缓存操作工具
 */
for (var _handle_name in cache) {
	if (cache.hasOwnProperty(_handle_name)) {
		var _handle = cache[_handle_name];
		if (_handle instanceof Function) {
			jhs[_handle_name] = _handle.bind(cache);
		}
	}
}
/*
 * 核心监听转发器
 */
jhs.all("*", co.wrap(function*(req, res, next) {
	const _start_time = Date.now();
	req.decode_pathname = decodeURI(req.path);

	const _g = console.group("◄".magenta + " " + req.decode_pathname);
	const _groupEnd = () => {
		const _end_time = Date.now();
		console.groupEnd(_g, "►".magenta + " " + req.decode_pathname, "━━┫", `[${res.statusCode}]`.colorsHead(), "┣━━", _end_time - _start_time, "ms");
	};

	var referer = req.header("referer");
	if (!referer) {
		referer = "http://" + req.header("host") + "/";
	}
	const http_header = referer.indexOf("https://") === 0 ? "https://" : "http://"
	const host = referer.replace(http_header, "").split("/")[0];
	if (host) {
		var origin = http_header + host;
	} else {
		origin = req.header("origin");
		host.replace(http_header, "");
	}
	const domain = tld.getDomain(origin) || "";
	req.headers["referer"] = referer;
	req.headers["origin"] = origin;
	req.headers["referer-host"] = host;
	req.headers["domain"] = domain;
	req.headers["protocol"] = http_header.replace("://", "");
	yield jhs.emitPromise("before_filter", req, res);
	/*
	 * 路由起始点
	 */
	jhs.emit_filter(req.decode_pathname, req, res, function() {
		if (res.body instanceof stream) {
			res.body.pipe(res);
		} else {
			res.end(res.body == undefined ? "" : String(res.body));
		}
		_groupEnd();
	}, function(err) {
		console.flag(502, err, res.body);
		res.status(502);
		res.end(err == undefined ? "" : String(err));
		_groupEnd();
	});
}));
/*
 * 基础规则监听
 */
// filename.ext
jhs.filter("*.:type(\\w+)", function(pathname, params, req, res) { // 有文件后缀的
	const type = params.type;
	console.log("[ 常规路由 ]".colorsHead(), pathname);

	return _route_to_file(jhs.getOptionsRoot(req), pathname, type, pathname, params, req, res).catch(err => {
		console.flag(500, err);
		res.status(500);
		res.body = err;
	});
});
// root/
const $目录型路由锁 = Symbol("目录型路由锁");
jhs.filter(/^(.*)\/?$/i, function(pathname, params, req, res) { // 没有文件后缀的
	const res_pathname = path.normalize(pathname + "/" + (jhs.getOptions(req).index || "index.html"));

	console.log("[ 目录型路由 ]".colorsHead(), pathname, "\n\t进行二次路由：", res_pathname);

	//处理后的地址再次出发路由，前提是不死循环触发
	if (!req[$目录型路由锁]) {
		req[$目录型路由锁] = true;
		return Promise.try((resolve, reject) => {
			jhs.emit_filter(res_pathname, req, res, resolve, reject);
		});
	}
});
//通用文件处理
/*
 * file_paths 目录或者目录列表
 * res_pathname 真正要返回的文件
 * pathname URL请求的文件，不代表最后要返回的文件
 */
const _route_to_file = co.wrap(function*(file_paths, res_pathname, type, pathname, params, req, res) {

	var _finally_type = type;

	const _start_time = Date.now();
	const _flag_head = ("[ " + type.placeholder(5) + "]").colorsHead();
	const _g = console.group(_flag_head, "=>", pathname, "\n\t", "=>", file_paths, res_pathname, "\n");

	const _groupEnd = () => {
		res.type(_finally_type);
		const _end_time = Date.now();
		console.groupEnd(_g, _flag_head, (_end_time - _start_time) + "ms");
	};
	try {

		//有大量异步操作，所以要把options缓存起来
		var jhs_options = jhs.getOptions(req);
		//统一用数组
		Array.isArray(file_paths) || (file_paths = [file_paths]);

		//如果是取MAP，直接取出
		var map_md5 = req.query._MAP_MD5_;
		var map_from = req.query._MAP_FROM_;

		if (map_md5 && map_from) {
			res.body = yield temp.get(map_from, map_md5);
			return
		}
		/*
		 * 404
		 */
		if (!(yield fss.existsFileInPathsMutilAsync(file_paths, pathname))) {
			res.status(404);
			res.type(type);
			if (type === "html") {
				var _404file_name = jhs_options["404"] || "404.html";
				if (!(yield fss.existsFileInPathsMutilAsync(file_paths, _404file_name))) {
					res.body = yield _get_404_file();
					return _groupEnd();
				}
				res_pathname = _404file_name;
			} else {
				return _groupEnd();
			}
		} else {
			res.status(200);
		}
		var file_path = file_paths.map(function(folder_path) {
			return folder_path + "/" + res_pathname;
		});

		const fileInfo = yield cache.getFileCache(file_path, cache.options.file_cache_time, jhs_options);

		res.body = yield fileInfo.source_stream; // 默认是一个流对象

		if (fileInfo.is_text) {
			var _path_info = path.parse(res_pathname);
			var _extname = _path_info.ext;
			var _filename = _path_info.base;
			var _basename = _path_info.name;
			res.is_text = true;
			res.text_file_info = {
				filename: _filename,
				basename: _basename,
				extname: _extname,
			};
		}
		const common_filter_handle_res = (jhs_options.common_filter_handle instanceof Function) && jhs_options.common_filter_handle(pathname, params, req, res);
		if (common_filter_handle_res instanceof Promise) {
			yield common_filter_handle_res;
		}
		yield jhs.emitPromise("*." + type, pathname, params, req, res);

		/*
		 * 用户自定义的处理完成后再做最后的处理，避免nunjucks的include、import指令导入的内容没有处理
		 */
		if (fileInfo.is_text) {
			const text_replacer = {
				"__pathname__": pathname, // URL请求的文件，不代表最后要返回的文件
				"__res_pathname__": res_pathname, // 真正要返回的文件路径，用来区分多目录的请求一个文件的情况
				"__filename__": _filename, // 完整文件名
				"__basename__": _basename, // 文件名体
				"__extname__": _extname, // 后缀
			};
			res.body = res.body.pipe(replaceStream(new RegExp(Object.keys(text_replacer).join("|"), "g"),
				key => text_replacer[key], {
					maxMatchLen: 16
				}));

			var _lower_case_extname = _extname.toLowerCase();
			var _lower_case_compile_to = req.query.compile_to;
			_lower_case_compile_to = (_lower_case_compile_to || "").toLowerCase();
			var _temp_body;
			/* TYPESCRIPT编译 */
			if (_lower_case_extname === ".ts" && /js|\.js/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_tsc_content) {
					res.body = fileInfo.compile_tsc_content;
				} else {
					if (_temp_body = yield temp.get("typescript", fileInfo.source_md5)) {
						res.body = fileInfo.compile_tsc_content = _temp_body.toString(); //Buffer to String
					} else {
						var tss = new TypeScriptSimple({
							sourceMap: jhs_options.tsc_sourceMap
						});
						try {
							var tsc_compile_resule = tss.compile(res.body, path.parse(fileInfo.filepath).dir);
							res.body = tsc_compile_resule;
							temp.set("typescript", fileInfo.source_md5, res.body);
						} catch (e) {
							console.log(e.stack)
								// res.status(500);
							res.body = '((window.console&&console.error)||alert).call(window.console,' + JSON.stringify(e.message) + ')';
						}
					}
				}
				_finally_type = "js";
			}
			/* Babel编译 */
			// if (((_lower_case_extname === ".bb" || _filename.endWith(".bb.js")) && /js|\.js/.test(_lower_case_compile_to)) || /bb_to_\.js/.test(_lower_case_compile_to)) {
			// 	if (fileInfo.compile_bb_content) {
			// 		res.body = fileInfo.compile_bb_content;
			// 	} else {
			// 		if (_temp_body = yield temp.get("babel-core", fileInfo.source_md5)) {
			// 			res.body = fileInfo.compile_bb_content = _temp_body.toString(); //Buffer to String
			// 		} else {
			// 			try {
			// 				console.time("Babel:" + _filename);
			// 				console.log(req.query);
			// 				var sourceMaps = $$.boolean_parse(req.query.debug)
			// 				var bb_compile_resule = BabelCore.transform(res.body, {
			// 					filename: __dirname + "/babel/" + _filename,
			// 					ast: false,
			// 					sourceMaps: sourceMaps,
			// 					babelrc: false,
			// 					code: true,
			// 					presets: ['es2015'],
			// 					ignore: ["node_modules/**/*.js"],
			// 					// plugins: ["syntax-async-generators"]
			// 				});

			// 				var code = bb_compile_resule.code;
			// 				if (sourceMaps) {
			// 					code += "\n//# sourceMappingURL=" + res_pathname +
			// 						"?_MAP_MD5_=" + fileInfo.source_md5 +
			// 						"&_MAP_FROM_=babel-core-map";
			// 					fileInfo.compile_bb_content_map = JSON.stringify(bb_compile_resule.map);
			// 					temp.set("babel-core-map", fileInfo.source_md5, fileInfo.compile_bb_content_map);
			// 				}

			// 				console.timeEnd("Babel:" + _filename);

			// 				res.body = fileInfo.compile_bb_content = code;
			// 				temp.set("babel-core", fileInfo.source_md5, res.body);
			// 			} catch (e) {
			// 				console.log(e.stack)
			// 					// res.status(500);
			// 				res.body = '((window.console&&console.error)||alert).call(window.console,' + JSON.stringify(e.message) + ')';
			// 			}
			// 		}
			// 	}
			//	_finally_type = "js";
			// }
			/* SASS编译 */
			if (_lower_case_extname === ".scss" && /css/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_sass_content) {
					res.body = fileInfo.compile_sass_content;
				} else {
					if (_temp_body = yield temp.get("sass", fileInfo.source_md5)) {
						// console.log("使用缓存，无需编译！！")
						res.body = fileInfo.compile_sass_content = _temp_body.toString(); //Buffer to String
					} else {
						var sass_compile_result = yield Promise.try((resolve, reject) => {
							sass.render({
								data: res.body,
								includePaths: [path.parse(fileInfo.filepath).dir]
							}, (err, res) => {
								err ? reject(err) : resolve(res);
							});
						});
						res.body = fileInfo.compile_sass_content = sass_compile_result.css.toString();
						temp.set("sass", fileInfo.source_md5, res.body);
					}
				}
				//文件内容变为CSS了，所以可以参与CSS文件类型的处理
				_lower_case_extname = ".css";
				_finally_type = "css";
			}
			/* LESS编译 */
			if (_lower_case_extname === ".less" && /css/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_less_content) {
					res.body = fileInfo.compile_less_content;
				} else {
					if (_temp_body = yield temp.get("less", fileInfo.source_md5)) {
						// console.log("使用缓存，无需编译！！")
						res.body = fileInfo.compile_less_content = _temp_body.toString(); //Buffer to String
					} else {
						var less_compile_result = yield Promise.try((resolve, reject) => {
							less.render(res.body, {
								paths: [path.parse(fileInfo.filepath).dir],
								filename: _filename
							}, (err, output) => {
								// console.log("output:::::", output)
								err ? reject(err) : resolve(output);
							});
						});
						res.body = fileInfo.compile_less_content = less_compile_result.css.toString();
						temp.set("less", fileInfo.source_md5, res.body);
					}
				}
				//文件内容变为CSS了，所以可以参与CSS文件类型的处理
				_lower_case_extname = ".css";
				_finally_type = "css";
			}
			/* CSS压缩 */
			if (jhs_options.css_minify && _lower_case_extname === ".css") {
				if (fileInfo.minified_css_content) {
					res.body = fileInfo.minified_css_content;
				} else {
					if (_temp_body = yield temp.get("css_minify", fileInfo.source_md5)) {
						res.body = fileInfo.minified_css_content = _temp_body.toString(); //Buffer to String
					} else {
						var clearcss_compile_result = yield Promise.try((resolve, reject) => {
							new CleanCSS().minify(res.body, function(err, minified) {
								err ? reject(err) : resolve(minified);
								if (minified.errors.length + minified.warnings.length) {
									minified.errors.forEach((err) => console.flag("CSS Error", err));
									minified.warnings.forEach((war) => console.flag("CSS Warn", war));
								}
							});
						});
						res.body = fileInfo.minified_css_content = clearcss_compile_result.styles;
						temp.set("css_minify", fileInfo.source_md5, res.body);
					}
				}
			}
			/* JS压缩 */
			if (jhs_options.js_minify && _lower_case_extname === ".js" || $$.boolean_parse(req.query.min)) {
				if (fileInfo.minified_js_content) {
					res.body = fileInfo.minified_js_content;
				} else {
					if (_temp_body = yield temp.get("js_minify", fileInfo.source_md5)) {
						res.body = fileInfo.minified_js_content = _temp_body.toString(); //Buffer to String
					} else {
						var js_minify_result = UglifyJS.minify(res.body, {
							fromString: true
						});
						res.body = fileInfo.minified_js_content = js_minify_result.code;
						temp.set("js_minify", fileInfo.source_md5, res.body);
					}
				}
			}
			/* HTML压缩 */
			if (jhs_options.html_minify && _lower_case_extname === ".html") {

			}
		}

		_groupEnd();
	} catch (e) {
		console.log("inline ", e)
		_groupEnd();
		throw e;
	}
});