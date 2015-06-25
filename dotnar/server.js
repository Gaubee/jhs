var cluster = require('cluster');
if (cluster.isMaster) {
	var numCPUs = 1 || require('os').cpus().length;
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('exit', function(worker, code, signal) {
		console.log('worker ' + worker.process.pid + ' died');
	});
} else {
	var os = require("os");
	var http = require("http");
	var net = require("net");
	var jhs = require("../index");
	var tld = require("tldjs");
	var config = require("./config");

	jhs.on("before_filter", function(req, res) {
		// console.log(req);
		// console.log(req.headers.domain, config.domain);
		var _domain = tld.getDomain(req.headers.host)
		if (_domain === config.domain) {
			var _sub_domain = tld.getSubdomain(req.headers.host);
			// console.log(_sub_domain);
			if (_sub_domain === "" || _sub_domain === "www") {
				jhs.options = config.www;
			} else if (_sub_domain === "admin") {
				jhs.options = config.admin;
			} else if (_sub_domain === "lib") {
				jhs.options = config.lib;
			}/* else if (_sub_domain === "d3") {
				jhs.options = config.new_bus;
			} */else {
				jhs.options = config.bus;
			}
		} else {
			jhs.options = config.bus;
		}
	});

	var ID_MAP = {};

	jhs.filter("*.html", function(path, params, req, res) {
		if (res.statusCode == "404") {
			console.log("找不到文件，触发404~");
		}
		var res_body = res.body.toString();
		// //获取预编译信息，SEO无法获取到，这是Ajax请求的 简化、合并
		// res_body.replace(/<\!--IMPORT\[\[([\s\S]+?)\]\]-->/g, function(s, per_build_info) {
		// 	console.log(per_build_info);
		// 	//标识
		// 	var _id = (+new Date).toString(36) + Math.random().toString(36).substr(2);
		// 	//依赖列表
		// 	var imports = per_build_info.split(",").map(function(module_name) {
		// 		return module_name.trim();
		// 	});
		// 	ID_MAP[_id] = {
		// 		_id: _id,
		// 		info: per_build_info,
		// 		imports: imports
		// 	};
		// 	res._manual_end = true;
		// 	var i = 5;
		// 	var _ti = setInterval(function() {
		// 		console.log(i);
		// 		i -= 1
		// 		res.write("<script src='http://localhost:3000/pre_build?visitor_id=" + encodeURIComponent(_id) + "&imports=" + encodeURIComponent(JSON.stringify(imports)) + "'></script>");
		// 		res.flush();
		// 		if (i <= 0) {
		// 			clearInterval(_ti);
		// 			res.end(res.body || "");
		// 		};
		// 	}, 1000);
		// 	return "";
		// });

		// res_body = res_body.replace(/\{\%([\W\w]+?)\%\}/g, function(s, key) {
		// 	return data[key] || ""
		// });
		res.body = res_body.replaceAll("__dotnar_lib_base_url__", "http://lib.dev-dotnar.com");

		(jhs.options.html_filter_handle instanceof Function) && jhs.options.html_filter_handle(path, params, req, res);
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
					console.error(e);
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

	jhs.on("ready", function() {
		jhs.listen(10090, function() {
			console.log("文件服务启动，Listen Start!");
			config.onready(jhs);
		});
	});
}