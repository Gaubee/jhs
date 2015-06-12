var express = require("express");
var filter = require("./lib/filter");
var cache = require("./lib/cache");
var fs = require("fs");
var path = require("path");
var jhs = express();
var mime = require("mime-types");
var tld = require("tldjs");
var _404file = cache.getFileCache(__dirname + "/404.html");

/*
 * 配置
 */
jhs.options = {};
jhs.filter = function(path, callback) {
	var f = filter.get(path);
	f.addHandle(callback);
};
/*
 * 包装的过滤器
 */
jhs.emit_filter = function(path, req, res, end) {
	var extend_args = Array.prototype.slice.call(arguments, 1);
	var _is_match_someone;
	filter.cache.forEach(function(f) {
		if (f.math(path)) {
			var args = [path, f.params, req, res];
			f.emitHandle.apply(f, args);
			_is_match_someone = true;
		}
	});
	if (_is_match_someone) {
		end();
	} else {
		console.error("找不到任何路由匹配信息");
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
	var referer = req.header("referer") || "";
	http_header = referer.indexOf("https://") === 0 ? "https://" : "http://"
	var host = referer.replace(http_header, "").split("/")[0];
	if (host) {
		var origin = http_header + host;
	} else {
		origin = req.header("origin");
		host.replace(http_header, "");
	}
	var domain = tld.getDomain(origin) || "";
	req.headers["origin"] = origin;
	req.headers["host"] = host;
	req.headers["domain"] = domain;
	req.headers["protocol"] = http_header.replace("//", "");
	jhs.emit_filter(req.path, req, res, function() {
		res.end(res.body || "");
	});
});
/*
 * 基础规则监听
 */
jhs.filter("*.:type(\\w+)", function(pathname, params, req, res) {
	var type = params.type;
	var _abs_file_path = path.normalize((jhs.options.root || __dirname) + "/" + pathname);
	res.set('Content-Type', mime.contentType(type));
	if (fs.existsSync(_abs_file_path)) {
		res.body = cache.getFileCache(_abs_file_path);
	} else {
		res.set('Content-Type', mime.contentType("html"));
		res.status(404);
		var _abs_404_path = path.normalize("/" + (jhs.options.index || "404.html"));
		if (fs.existsSync(_abs_file_path)) {
			res.body = cache.getFileCache(_abs_file_path);
		} else {
			res.body = _404file;
		}
	}
	try {} catch (e) { //404
		try {
			res.body = cache.getFileCache();
		} catch (e) {
			console.error(e)
		}
	}
	return true; //继续遍历
});

//index file
jhs.filter("/", function(pathname, params, req, res) {
	jhs.emit_filter(path.normalize("/" + (jhs.options.index || "index.html")), req, res, function() {
		res.end(res.body || "");
	});
});

module.exports = jhs;