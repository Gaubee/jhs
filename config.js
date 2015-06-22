var os = require("os");
var fs = require("fs");
var nunjucks = require("nunjucks");

// var server_host = os.type() === "Linux" ? "api.dotnar.com" : "127.0.0.1";
var app;
var client_id = $$.uuid("CLIENT_"); //TCP数据的分割标识

var config = {
	onready: function(_app) {
		app = _app;
		var bufferList = [];
		var conn = app.server_conn;
		conn.on("data", function(data) {
			data = data.toString();
			// console.log(data);
			bufferList.push(data);
			//发现结束符，开始解析
			if (data.indexOf(conn.client_id) !== -1) {
				conn.emit("data-parser")
			}
		});
		conn.client_id = client_id;

		conn.on("data-parser", function() {
			var data = bufferList.join("");
			var index = data.indexOf(conn.client_id);
			var left_data = data.substr(0, index);
			var right_data = data.substr(index + conn.client_id.length);
			conn.emit("data-end", left_data);

			bufferList = [];
			bufferList.push(right_data);
			if (right_data.indexOf(conn.client_id) !== -1) {
				conn.emit("data-parser")
			}
		});
		conn.on("data-end", function(data) {
			try {
				data = JSON.parse(data.toString());
			} catch (e) {
				console.log("data:", data.toString());
				throw e;
			}
			// console.log(data);
			if (data.response_id) {
				app.emit("res:" + data.response_id, data.error, data);
			}
		});
		conn.send = function(data) {
			if (!conn.client_id) {
				console.error("客户端未初始化，无法返回数据");
			} else {
				conn.write(data + conn.client_id);
			}
		};
		//初始化模式不需要发送结束标识，否则无法解析
		app.server_conn.write(JSON.stringify({
			type: "init",
			client_id: client_id
		}));
		app.once("res:server_socket-init", function() {
			console.log("初始化连接成功");
		});
	},
	domain: "dev-dotnar.com",
	www: {
		root: "E:/kp2/dotnar/public",
		index: "dotnar.main.html"
	},
	admin: {
		root: "E:/kp2/admin_dotnar/public",
		index: "admin-beta.html"
	},
	bus: {
		root: "E:/kp2/O2O_fontend/public",
		index: "main-beta.html",
		template_map: Object.create(null),
		md5_map: Object.create(null),
		html_filter_handle: function(path, params, req, res) { //注入商家信息
			var body_ma5 = $$.md5(res.body);
			var template_map = this.template_map;
			var md5_map = this.md5_map;
			if (md5_map[path] !== body_ma5) { //MD5校验，如果文件已经发生改变，则清除模板重新编译
				template_map[path] = null;
			}
			//编译模板
			var tmp = template_map[path];
			if (!tmp) {
				var nunjucks_env = nunjucks.configure(config.bus.root, {
					watch: false, //不配置的话，会导致watch文件而不结束进程
					tags: {
						blockStart: '<%',
						blockEnd: '%>',
						variableStart: '<$',
						variableEnd: '$>',
						commentStart: '<-#',
						commentEnd: '#->'
					},
				});
				tmp = template_map[path] = nunjucks.compile(res.body, nunjucks_env);
			}
			//终止默认相应
			res._manual_end = true;
			//请求 配置信息、商家信息
			var response_id = $$.uuid(); //响应标识
			// console.log("cookie:", req.headers["cookie"]);
			app.server_conn.send(JSON.stringify({
				type: "get-dotnar_render_data",
				response_id: response_id,
				host: req.headers["referer-host"],
				data_list: ["appConfig", "busInfo", "loginUser"],
				cookie: req.headers["cookie"]
			}));
			//注册响应事件
			app.once("res:" + response_id, function(error, resData) {
				if (error) {
					throw error;
				}
				// console.log(resData.data);
				// console.log(res.body);
				res.end(tmp.render(resData.data));
			});
		}
	},
	new_bus: {
		root: "E:/kp2/新版本前端/dev-kit",
		index: "app.html",
		"404": "app.html", //错误页也自动导向主页，而后用JS进行动态加载404页面
		template_map: Object.create(null),
		md5_map: Object.create(null),
		html_filter_handle: function(path, params, req, res) {
			console.log(this.root + path, res.statusCode, fs.existsSync(this.root + "/app-pages" + path));
			if (res.statusCode == 404 && fs.existsSync(this.root + "/app-pages" + path)) {
				res.status(200); //找得到，不是真正的404
			}
			var body_ma5 = $$.md5(res.body);
			var template_map = this.template_map;
			var md5_map = this.md5_map;
			if (md5_map[path] !== body_ma5) { //MD5校验，如果文件已经发生改变，则清除模板重新编译
				template_map[path] = null;
			}
			//编译模板
			var tmp = template_map[path];
			if (!tmp) {
				var nunjucks_env = nunjucks.configure(config.new_bus.root, {
					watch: false, //不配置的话，会导致watch文件而不结束进程
					tags: {
						blockStart: '<%',
						blockEnd: '%>',
						variableStart: '<$',
						variableEnd: '$>',
						commentStart: '<-#',
						commentEnd: '#->'
					},
				});
				tmp = template_map[path] = nunjucks.compile(res.body, nunjucks_env);
			}
			//终止默认相应
			res._manual_end = true;
			//请求 配置信息、商家信息
			var response_id = $$.uuid(); //响应标识
			// console.log("cookie:", req.headers["cookie"]);
			app.server_conn.send(JSON.stringify({
				type: "get-dotnar_render_data",
				response_id: response_id,
				host: req.headers["referer-host"],
				data_list: ["appConfig", "busInfo", "loginUser"],
				cookie: req.headers["cookie"]
			}));
			//注册响应事件
			app.once("res:" + response_id, function(error, resData) {
				if (error) {
					throw error;
				}
				// console.log(resData.data);
				// console.log(res.body);
				res.end(tmp.render(resData.data));
			});
		}
	},
	lib: {
		root: "E:/kp2/O2O_front_end_lib"
	}
};
module.exports = config;