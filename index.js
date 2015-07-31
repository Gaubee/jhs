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
var _404file = cache.getFileCacheContent(__dirname + "/lib/404.html");
/*
 * 初始化
 */
jhs.use(compression());

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
		res.status(404).end(_404file);
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
			if (res._manual_end) {
				// console.log("发送源文件被拦截");
			} else {
				res.end(res.body || "");
			}
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
//通用文件处理
function _route_to_file(_file_path, type, pathname, params, req, res) {
	if (type == "html") {
		console.log("[", type, "]=>", pathname, "\n\t=>", _file_path, "\n");
	}
	if (!fs.existsSync(_file_path)) {
		res.status(404);
		var _404file_path = path.normalize((jhs.options.root || __dirname) + "/" + (jhs.options["404"] || "404.html"));
		if (!fs.existsSync(_404file_path)) {
			res.set('Content-Type', mime.contentType("html"));
			res.body = _404file;
			return;
		}
		_file_path = _404file_path;
	}

	res.set('Content-Type', mime.contentType(type));
	var fileInfo = cache.getFileCache(_file_path);
	res.body = fileInfo.source_content;

	if (fileInfo.is_text) {
		var extname = path.extname(_file_path);
		var filename = path.basename(_file_path);
		var basename = path.basename(filename, extname);
		res.body = res.body.replaceAll("__pathname__", pathname)
			.replaceAll("__filename__", filename)
			.replaceAll("__basename__", basename)
			.replaceAll("__extname__", extname);
		res.is_text = true;
		res.text_file_info = {
			filename: filename,
			basename: basename,
			extname: extname,
		};
	}
	(jhs.options.common_filter_handle instanceof Function) && jhs.options.common_filter_handle(pathname, params, req, res);

	jhs.emit("*." + type, pathname, params, req, res)
};

module.exports = jhs;