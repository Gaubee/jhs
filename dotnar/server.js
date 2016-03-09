const os = require("os");
const http = require("http");
const net = require("net");
const jhs = global.jhs = require("../index");
const tld = require("tldjs");
const config = require("./config");
// jhs.options.debug = false;

jhs.on("before_filter", co.wrap(function*(req, res) {
	var _domain = tld.getDomain(req.headers.host)
	console.log("REQ.HEADERS.HOST:", req.headers.host);
	var jhs_options;
	if (_domain === config.domain) {
		var _sub_domain = tld.getSubdomain(req.headers.host);
		if (_sub_domain === "" || _sub_domain === "www") {
			jhs_options = config.www;
		} else if (_sub_domain === "admin") {
			jhs_options = config.admin;
		} else if (_sub_domain === "lib") {
			jhs_options = config.lib;
		}
		/* else if (_sub_domain === "d3") {
			jhs_options = config.new_bus;
		} */
		else {
			jhs_options = config.bus;
		}
	} else {
		jhs_options = config.bus;
	}
	req.jhs_options = jhs_options;
	const before_filter_res = jhs_options.before_filter && jhs_options.before_filter(req, res);
	if (before_filter_res instanceof Promise) {
		yield before_filter_res
	}
	/*
	 * AOP 替换所有文本的__dotnar_lib_base_url__
	 */
	var common_filter_handle = jhs_options.common_filter_handle;
	if (!(common_filter_handle && common_filter_handle._is_aop)) {
		jhs_options.common_filter_handle = co.wrap(function*(pathname, params, req, res) {
			const cfh_res = common_filter_handle && common_filter_handle.apply(this, arguments);
			if (cfh_res instanceof Promise) {
				yield cfh_res;
			}
			if (res.is_text) {
				res.body = res.body.replaceAll("__dotnar_lib_base_url__", config.base_config.lib_url)
				res.body = res.body.replaceAll("__location_origin_url__", req.headers["origin"] || "")
			}
		});
		jhs_options.common_filter_handle._is_aop = true
	}
}));

var ID_MAP = {};

jhs.on("*.html", function(path, params, req, res) {
	var jhs_options = jhs.getOptions(req);
	if (res.statusCode == "404") {
		console.log("找不到文件，触发404~");
	}
	return (jhs_options.html_filter_handle instanceof Function) && jhs_options.html_filter_handle(path, params, req, res);
});
jhs.on("*.js", function(path, params, req, res) {
	var jhs_options = jhs.getOptions(req);
	return (jhs_options.js_filter_handle instanceof Function) && jhs_options.js_filter_handle(path, params, req, res);
});

jhs.on("*.css", function(path, params, req, res) {
	var jhs_options = jhs.getOptions(req);
	return (jhs_options.css_filter_handle instanceof Function) && jhs_options.css_filter_handle(path, params, req, res);
});


/*
 * 获取后台信息 并 连接后台数据服务
 */
var _server_host;
var _server_port;
if (os.type() === "Linux") {
	_server_host = "api.dotnar.com"
	_server_port = 80;
} else {
	_server_host = "127.0.0.1"
	_server_port = 3000;
}
var server_info = {};

function _get_server_info() {
	var _server_info_url = "http://" + _server_host + ":" + _server_port + "/pre_build/base_config";
	console.log("获取服务器信息", _server_info_url);
	http.get(_server_info_url, function(res) {
		var buffList = [];
		res.on("data", function(data) {
			buffList.push(data)
		});
		res.on("end", function() {
			var json_str = Buffer.concat(buffList).toString();
			// console.log("服务器返回信息：", json_str);
			try {
				server_info = JSON.parse(json_str);
			} catch (e) {
				console.error(e, json_str);
				setTimeout(_get_server_info, 1000);
				return;
			}
			console.log("服务器信息解析完成");
			_link_server();
		});
		res.on("error", function(e) {
			console.log("数据传输出错：", e.message);
			if (!server_info) {
				console.log("1s后尝试重新获取数据");
				setTimeout(_get_server_info, 1000);
			}
		})
	}).on("error", function(e) {
		console.log("连接出错：", e.message);
		console.log("1s后尝试重新获取数据");
		setTimeout(_get_server_info, 1000);
	});
};

function _link_server() {
	var socket_client = new net.Socket;
	console.log("开始连接服务器");
	socket_client.connect({
		host: _server_host,
		port: server_info.port
	}, function() {
		console.log("与服务器连接成功");
		jhs.server_conn = socket_client;
		jhs.emit("ready")
	}).on("error", function(e) {
		console.log("连接断开：", e.message);
		console.log("1s后尝试重新获取数据并重新建立连接");
		setTimeout(_get_server_info, 1000);
	});;
}
_get_server_info();

jhs.once("ready", function() {
	jhs.listen(10090, function() {
		console.log("文件服务启动，Listen Start!");
	});
});
jhs.on("ready", function() {
	config.onready(jhs);
});