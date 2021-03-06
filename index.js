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
const BabelCore = require("babel-standalone");
const sass = require('node-sass');
const less = require('less');
const CleanCSS = require('clean-css');
const UglifyJS = require("uglify-js");
const stream = require("stream");
const replaceStream = jhs.replaceStream = require("replacestream");

/*
 * 初始化
 */
// jhs.use(compression()); // GZIP
jhs.fs = jhs.fss = fss;
jhs.cache = cache;
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
jhs.emit_filter = function(path, req, res) {
	return Promise.try((resolve, reject) => {
		var extend_args = Array.prototype.slice.call(arguments, 1);
		var _is_match_someone;
		filter.cache.some(function(f) { // 只触发一个匹配路由
			if (f.math(path)) {
				var args = [path, f.params, req, res];
				_is_match_someone = true;
				f.emitHandle.apply(f, args).then(resolve).catch(reject);
				return true;
			}
		});
		if (!_is_match_someone) {
			console.error("找不到任何路由匹配信息", path);
			res.status(404);
			resolve();
		}
	});
};
/*
 * 可处理Promise的emit
 */
jhs.emitPromise = co.wrap(function*(event_name) {
	const events = jhs._events[event_name];
	if (events) {
		const _flag_head = ("[ EMIT:" + event_name + " ]").colorsHead();
		const _g = console.group(_flag_head);
		try {
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
		} catch (e) {
			console.error(e)
			console.groupEnd(_g, _flag_head);
		}
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
	try {
		yield jhs.emit_filter(req.decode_pathname, req, res);
		try {
			if (res.body instanceof stream) {
				// 如果HTTP协议，把头文件信息拷贝过来
				// if (res.body.headers) {
				// 	Object.keys(res.body.headers).forEach(key => {
				// 		res.set(key, res.body.headers[key])
				// 	});
				// }
				res.body.pipe(res);
			} else {
				res.end(res.body == undefined ? "" : String(res.body));
			}
			_groupEnd();
		} catch (e) {
			console.flag("QAQ", e);
		}
	} catch (err) {
		console.flag(502, err, res.body);
		res.status(502);
		res.end(err == undefined ? "" : String(err));
		_groupEnd();
	}
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
		return jhs.emit_filter(res_pathname, req, res);
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

	const _groupEnd = () => jhs.emitPromise(`status:${res.statusCode}`, file_paths, res_pathname, type, pathname, params, req, res).then(() => {
		res.type(_finally_type);
		const _end_time = Date.now();
		console.groupEnd(_g, _flag_head, (_end_time - _start_time) + "ms");
	});
	try {

		//有大量异步操作，所以要把options缓存起来
		var jhs_options = jhs.getOptions(req);
		//统一用数组
		Array.isArray(file_paths) || (file_paths = [file_paths]);

		//如果是取MAP，直接取出
		var map_md5 = req.query._MAP_MD5_;
		var map_from = req.query._MAP_FROM_;

		if (map_md5 && map_from) {
			console.flag("TEMP", "get sourceMap file from temp", map_from.green, map_md5);
			res.body = yield temp.getStream(map_from, map_md5);
			return yield _groupEnd();
		}
		/*
		 * req file info
		 */
		var _path_info = path.parse(res_pathname);
		var _extname = _path_info.ext;
		var _filename = _path_info.base;
		var _basename = _path_info.name;
		res.file_info = {
			pathname: pathname,
			res_pathname: res_pathname,
			filename: _filename,
			basename: _basename,
			extname: _extname,
		};
		/*
		 * 404
		 */
		if (!(yield fss.existsFileInPathsMutilAsync(file_paths, pathname))) {
			res.status(404);
			res.type(type);
			if (type === "html") {
				var _404file_name = jhs_options["404"] || "404.html";
				if (!(yield fss.existsFileInPathsMutilAsync(file_paths, _404file_name))) {
					res.body = yield cache.getFileCacheContent(__dirname + "/lib/404.html"); //404 file stream
					return yield _groupEnd();
				}
				res_pathname = _404file_name;
			} else {
				return yield _groupEnd();
			}
		} else {
			res.status(200);
		}
		var file_path = file_paths.map(function(folder_path) {
			return folder_path + "/" + res_pathname;
		});

		const fileInfo = yield cache.getFileCache(file_path, cache.options.file_cache_time, jhs_options);

		res.body = yield fileInfo.source_stream; // 默认是一个流对象

		res.is_text = fileInfo.is_text;

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
			var source_md5;
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
					res.body = yield fileInfo.compile_tsc_content;
				} else {
					source_md5 || (source_md5 = yield fileInfo.source_md5);
					if (yield temp.has("typescript", source_md5)) {
						res.body = yield(fileInfo.compile_tsc_content = () => temp.getStream("typescript", source_md5))();
					} else {
						var sourceMaps = $$.boolean_parse(req.query.debug);
						var tss = new TypeScriptSimple({
							sourceMap: sourceMaps
						});
						try {
							var tsc_compile_resule = tss.compile(res.body, path.parse(fileInfo.filepath).dir);
							res.body = tsc_compile_resule;
							yield temp.set("typescript", source_md5, res.body);
							fileInfo.compile_tsc_content = () => temp.getStream("typescript", source_md5);
						} catch (e) {
							console.log(e);
							res.body = '((window.console&&console.error)||alert).call(window.console,' + JSON.stringify(e.message) + ')';
						}
					}
				}
				_finally_type = "js";
			}
			/* Babel编译 */
			if (((_lower_case_extname === ".es6" || _filename.endWith(".es6.js")) && /js|\.js/.test(_lower_case_compile_to)) || /es6_to_\.js/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_es6_content) { // 内存中取
					res.body = yield fileInfo.compile_es6_content();
				} else {
					source_md5 || (source_md5 = yield fileInfo.source_md5);
					if (yield temp.has("es6", source_md5)) { // 缓存目录区，顺便引用到内存
						res.body = yield(fileInfo.compile_es6_content = () => temp.getStream("es6", source_md5))();
					} else { // 编译
						var sourceMaps = $$.boolean_parse(req.query.debug);
						const es6_compile_config = Object.assign({
							ast: false,
							sourceMaps: sourceMaps,
							// babelrc: false,
							code: true,
							presets: ['es2015'],
							plugins: [
								'transform-async-to-generator',
								'transform-minify-booleans',
							]
						}, jhs_options.es6_compile_config, {
							filename: fileInfo.filepath,
						});
						// console.log(es6_compile_config)
						try {
							var es6_code_str = "" + (yield Promise.readStream(res.body));
							var es6_compile_resule = BabelCore.transform(es6_code_str, es6_compile_config);

							if (sourceMaps) {
								es6_compile_resule.code += "\n//@ sourceMappingURL=" + res_pathname +
									".map?_MAP_MD5_=" + source_md5 +
									"&_MAP_FROM_=es6-source-maps";
								yield temp.set("es6-source-maps", source_md5, JSON.stringify(es6_compile_resule.map));
							}
							res.body = es6_compile_resule.code;
							yield temp.set("es6", source_md5, res.body);
							fileInfo.compile_es6_content = () => temp.getStream("es6", source_md5);
						} catch (e) {
							console.log(e);
							// res.status(500);
							res.body = '((window.console&&console.error)||alert).call(window.console,' + JSON.stringify(e.message) + ')';
						}
					}
				}
				_finally_type = "js";
			}
			/* SASS编译 */
			if (_lower_case_extname === ".scss" && /css/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_sass_content) {
					res.body = yield fileInfo.compile_sass_content();
				} else {
					/*
					 * SASS文件不直接从TEMP中获取，因为@import动态的依赖的解析是被动的，所以一定要通过走编译来得到
					 */
					// if (yield temp.has("sass", source_md5)) {
					// 	res.body = yield(fileInfo.compile_sass_content = () => temp.getStream("sass", source_md5))();
					// } else {
					var sass_sourceMap = $$.boolean_parse(req.query.debug);
					const sass_code_str = "" + (yield Promise.readStream(res.body));
					const sass_compile_config = {
						file: fileInfo.filepath,
						outFile: path.parse(fileInfo.filepath).dir + "/" + _basename + ".css",
						data: sass_code_str,
						importer: function(url, prev, done) {
							co(function*() {
								const file_path = file_paths.map(function(folder_path) {
									return folder_path + "/" + fileInfo._folderpath_without_root + "/" + url;
								});
								// 添加依赖
								file_path.forEach(dep_filepath => fss.addDepens(fileInfo.filepath, dep_filepath));

								const import_fileInfo = yield cache.getFileCache(file_path, cache.options.file_cache_time, jhs_options);
								const fileBuffer = yield Promise.readStream(yield import_fileInfo.source_stream);
								done({
									// file: import_fileInfo.filepath,
									file: path.parse(fileInfo.filepath).dir + "/" + url, //跨目录会导致和sourceMap里面的信息匹配不上
									contents: fileBuffer.toString()
								});
							}, err => {
								console.flag("sass importer error", err)
							});
						},
						includePaths: file_paths,
						sourceMap: sass_sourceMap,
						outputStyle: jhs_options.css_minify ? "compressed" : "nested"
					};
					// console.flag("sass_compile_config", sass_compile_config);
					const sass_compile_result = yield Promise.try((resolve, reject) => {
						sass.render(sass_compile_config, (err, res) => {
							err ? reject(err) : resolve(res);
						});
					});
					// console.log(sass_compile_result);
					if (sass_sourceMap) {
						source_md5 || (source_md5 = yield fileInfo.source_md5);
						sass_compile_result.css += "\n/*# sourceMappingURL=" + res_pathname +
							".map?_MAP_MD5_=" + source_md5 +
							"&_MAP_FROM_=sass-source-maps*/"
						yield temp.set("sass-source-maps", source_md5, sass_compile_result.map);
					}
					res.body = sass_compile_result.css;
					yield temp.set("sass", source_md5, res.body);
					fileInfo.compile_sass_content = () => temp.getStream("sass", source_md5);
					// }
				}
				_finally_type = "css";
			}
			/* LESS编译 */
			if (_lower_case_extname === ".less" && /css/.test(_lower_case_compile_to)) {
				if (fileInfo.compile_less_content) {
					res.body = yield fileInfo.compile_less_content();
				} else {
					source_md5 || (source_md5 = yield fileInfo.source_md5);
					if (yield temp.has("less", source_md5)) { // 缓存目录区，顺便引用到内存
						// console.log("使用缓存，无需编译！！")
						res.body = yield(fileInfo.compile_less_content = () => temp.getStream("less", source_md5))();
					} else {
						var less_code_str = "" + (yield Promise.readStream(res.body));
						var less_compile_result = yield Promise.try((resolve, reject) => {
							less.render(less_code_str, {
								paths: file_paths,
								filename: _filename
							}, (err, output) => {
								// console.log("output:::::", output)
								err ? reject(err) : resolve(output);
							});
						});
						res.body = less_compile_result.css;
						yield temp.set("less", source_md5, res.body);
						fileInfo.compile_less_content = () => temp.getStream("less", source_md5);
					}
				}
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

		yield _groupEnd();
	} catch (e) {
		yield _groupEnd();
		throw e;
	}
});