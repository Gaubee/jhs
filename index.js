var Fiber = require("fibers");
require("./lib/global")
var express = require("express");
var compression = require('compression');
var filter = require("./lib/filter");
var cache = require("./lib/cache");
var fs = require("fs");
var path = require("path");
var jhs = express();
var mime = require("mime-types");
var tld = require("tldjs");
var TypeScriptSimple = require('typescript-simple').TypeScriptSimple;
var sass = require('node-sass');
var CleanCSS = require('clean-css');
var UglifyJS = require("uglify-js");
var _404file;

function _get_404_file() {
	return cache.getFileCacheContent(__dirname + "/lib/404.html");
};
/*
 * 初始化
 */
jhs.use(compression());
jhs.cache = cache;

/*
 * 配置
 */
jhs.options = {};
jhs.filter = function(path, callback, options) {
	var f = filter.get(path, options);
	f.addHandle(callback);
};
/*
 * 包装的过滤器
 */
jhs.emit_filter = function(path, req, res, end) {
	var extend_args = Array.prototype.slice.call(arguments, 1);
	var _is_match_someone;
	filter.cache.some(function(f) {
		if (f.math(path)) {
			var args = [path, f.params, req, res];
			_is_match_someone = true;
			return f.emitHandle.apply(f, args);
		}
	});
	if (_is_match_someone) {
		end && end();
	} else {
		console.error("找不到任何路由匹配信息", path);
		res.set('Content-Type', mime.contentType("html"));
		res.status(404).end(_get_404_file());
	}
};
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
jhs.all("*", function(req, res, next) {
	var referer = req.header("referer");
	if (!referer) {
		referer = "http://" + req.header("host") + "/";
	}
	http_header = referer.indexOf("https://") === 0 ? "https://" : "http://"
	var host = referer.replace(http_header, "").split("/")[0];
	if (host) {
		var origin = http_header + host;
	} else {
		origin = req.header("origin");
		host.replace(http_header, "");
	}
	var domain = tld.getDomain(origin) || "";
	req.headers["referer"] = referer;
	req.headers["origin"] = origin;
	req.headers["referer-host"] = host;
	req.headers["domain"] = domain;
	req.headers["protocol"] = http_header.replace("://", "");
	jhs.emit("before_filter", req, res);
	/*
	 * 路由起始点
	 */
	Fiber(function() {
		jhs.emit_filter(req.path, req, res, function() {
			res.end(res.body || "");
		});
	}).run();
});
/*
 * 基础规则监听
 */
// filename.ext
jhs.filter("*.:type(\\w+)", function(pathname, params, req, res) {
	var type = params.type;
	var _file_path = path.normalize((jhs.options.root || __dirname) + "/" + pathname);

	_route_to_file(_file_path, type, pathname, params, req, res);
	return true;
});
// root/
jhs.filter(/^(.*)\/$\/?$/i, function(pathname, params, req, res) {
	var pathname_2 = path.normalize(pathname + (jhs.options.index || "index.html"));

	console.log("目录型路由", pathname, "\n\t进行二次路由：", pathname_2);

	var _file_path = path.normalize((jhs.options.root || __dirname) + pathname_2);
	var type = _file_path.split(".").pop();

	_route_to_file(_file_path, type, pathname, params, req, res);

	//处理后的地址再次出发路由，前提是不死循环触发
	if (pathname_2.charAt(pathname_2.length - 1) !== "/") {
		jhs.emit_filter(pathname_2, req, res);
	}
	return true;
});
//层级搜寻文件
function _read_file_by_arry_root(file_paths, pathname) {
	var result;
	if (Array.isArray(file_paths)) {
		file_paths.some(function(file_path) {
			result = _read_file_by_arry_root(file_path, pathname);
			return result.status !== 404
		});
	} else {
		var _file_path = path.normalize(file_paths, pathname);
		result = {
			filepath: _file_path
		};
		if (!fs.existsSync(_file_path)) {
			result.status = 404;
		} else {
			result.status = 200;
			result.body = cache.getFileCache(_file_path);
		}
	}
};
//通用文件处理
function _route_to_file(_file_path, type, pathname, params, req, res) {

	console.log(("[ " + type.placeholder(5) + "]").colorsHead(), "=>", pathname.placeholder(60, "\n\t"), "=>", _file_path, "\n")

	if (!fs.existsSync(_file_path)) {
		res.status(404);
		var _404file_path = path.normalize((jhs.options.root || __dirname) + "/" + (jhs.options["404"] || "404.html"));
		if (!fs.existsSync(_404file_path)) {
			res.set('Content-Type', mime.contentType("html"));
			res.body = _get_404_file();
			return;
		}
		_file_path = _404file_path;
	}

	var content_type = mime.contentType(type);
	res.set('Content-Type', content_type);
	var fileInfo = cache.getFileCache(_file_path);
	res.body = fileInfo.source_content;


	if (fileInfo.is_text) {
		var extname = path.extname(_file_path);
		var filename = path.basename(_file_path);
		var basename = path.basename(filename, extname);
		res.is_text = true;
		res.text_file_info = {
			filename: filename,
			basename: basename,
			extname: extname,
		};
	}

	(jhs.options.common_filter_handle instanceof Function) && jhs.options.common_filter_handle(pathname, params, req, res);

	jhs.emit("*." + type, pathname, params, req, res);

	/*
	 * 用户自定义的处理完成后再做最后的处理，避免nunjucks的include、import指令导入的内容没有处理
	 */
	if (fileInfo.is_text) {
		res.body = res.body.replaceAll("__pathname__", pathname)
			.replaceAll("__filename__", filename)
			.replaceAll("__basename__", basename)
			.replaceAll("__extname__", extname);
		var _lower_case_extname = extname.toLowerCase();
		var _lower_case_compile_to = req.query.compile_to;
		_lower_case_compile_to = (_lower_case_compile_to || "").toLowerCase();
		/* TYPESCRIPT编译 */
		if (_lower_case_extname === ".ts" && /js|\.js/.test(_lower_case_compile_to)) {
			if (fileInfo.compile_tsc_content) {
				res.body = fileInfo.compile_tsc_content;
			} else {
				var tss = new TypeScriptSimple({
					sourceMap: jhs.options.tsc_sourceMap
				});
				var tsc_compile_resule = tss.compile(res.body, path.parse(_file_path).dir)
			}
		}
		/* SASS编译 */
		if (_lower_case_extname === ".scss" && /css|\.css/.test(_lower_case_compile_to)) {
			if (fileInfo.compile_sass_content) {
				res.body = fileInfo.compile_sass_content;
			} else {
				var sass_compile_result = sass.renderSync({
					data: res.body,
					includePaths: [path.parse(_file_path).dir]
				});
				res.body = fileInfo.compile_sass_content = sass_compile_result.css.toString();
			}
			//文件内容变为CSS了，所以可以参与CSS文件类型的处理
			extname = ".css";
		}
		/* CSS压缩 */
		if (jhs.options.css_minify && _lower_case_extname === ".css") {
			if (fileInfo.minified_css_content) {
				res.body = fileInfo.minified_css_content;
			} else {
				var fiber = Fiber.current;
				new CleanCSS().minify(res.body, function(err, minified) {
					if (err) {
						console.log("[CleanCSS Minify Error]".colorsHead(), "=>", err);
					}
					res.body = fileInfo.minified_css_content = minified.styles;
					if (minified.errors.length + minified.warnings.length) {
						minified.errors.forEach(function(err) {
							console.log("[CSS Error]".colorsHead(), "=>", err);
						});
						minified.warnings.forEach(function(war) {
							console.log("[CSS Warn]".colorsHead(), "=>", war);
						});
					}
					fiber.run();
				});
				Fiber.yield();
			}
		}
		/* JS压缩 */
		if (jhs.options.js_minify && _lower_case_extname === ".js") {
			if (fileInfo.minified_js_content) {
				res.body = fileInfo.minified_js_content;
			} else {
				var js_minify_result = UglifyJS.minify(res.body, {
					fromString: true
				});
				res.body = fileInfo.minified_js_content = js_minify_result.code;
			}
		}
		/* HTML压缩 */
		if (jhs.options.html_minify && _lower_case_extname === ".html") {

		}
	}
};

module.exports = jhs;