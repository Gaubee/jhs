var Fiber = require("fibers");
var os = require("os");
var fs = require("fs");
var nunjucks = require("nunjucks");
var jhs = require("../index");

// var server_host = os.type() === "Linux" ? "api.dotnar.com" : "127.0.0.1";
var app;
var client_id = $$.uuid("CLIENT_"); //TCP数据的分割标识

var is_dev;
var file_key = "product";
process.argv.some(function(key) {
	if (key.indexOf("-dev") === 0) {
		file_key = key.split("-dev:")[1] || "dev";
		return (is_dev = true);
	}
});
console.log(is_dev ? "开发模式" : "部署模式");
var base_config = require("./" + file_key + ".config");


var _nunjucks_env_map = new Map;

function _build_nunjucks(pathname) {
	if (_nunjucks_env_map.has(pathname)) {
		return _nunjucks_env_map.get(pathname);
	}
	var nunjucks_env = nunjucks.configure(pathname, {
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
	nunjucks_env.addFilter('tojson', function(obj) {
		return JSON.stringify(obj);
	});
	_nunjucks_env_map.set(pathname, nunjucks_env);
	return nunjucks_env;
};

function _get_render_data_cache(options, return_cb) {
	var key = "bus_render_data:" + [
		options.type,
		options.host,
		options.data_list,
	].join(" | ");
	if (!jhs.cache.hasClockCache(key)) {
		jhs.cache.defineClockCache(key, "time", {
			get_value_handle: function(return_cb) {
				var response_id = $$.uuid(); //响应标识
				//请求 配置信息、商家信息
				app.server_conn.send(JSON.stringify({
					type: options.type,
					response_id: response_id,
					host: options.host,
					data_list: options.data_list,
					cookie: options.cookie
				}));
				//注册响应事件
				app.once("res:" + response_id, function(error, resData) {
					if (error) {
						throw error;
					}
					return_cb(resData.data);
				});
			},
			time: 3800,
			debug: true
		});
	}
	jhs.cache.getClockCache(key, return_cb);
};
var config = {
	base_config: base_config,
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
	domain: base_config.domain,
	www: {
		root: base_config.www_root,
		index: "dotnar.main.html"
	},
	admin: {
		root: base_config.admin_root,
		index: "admin-beta.html"
	},
	bus: {
		root: base_config.bus_root,
		index: "app.html",
		"404": "app.html", //错误页也自动导向主页，而后用JS进行动态加载404页面
		template_map: Object.create(null),
		md5_map: Object.create(null),
		before_filter: function(req, res) {
			var _is_mobile;
			var _is_weixin;
			var _user_agent = req.header("user-agent");
			_is_mobile = req.is_mobile = $$.isMobile(_user_agent);
			if (_is_mobile) {
				req.is_weixin = $$.isWeiXin(_user_agent);
			}
			// //请求 配置信息、商家信息
			// var fiber = Fiber.current;
			// _get_render_data_cache({
			// 	type: "get-dotnar_render_data",
			// 	host: req.headers["referer-host"],
			// 	data_list: ["appConfig", "busInfo"],
			// 	cookie: req.headers["cookie"]
			// }, function(render_data) {
			// 	res.template_root = '/////';
			// 	fiber.run();
			// });
			// Fiber.yield();
			res.template_root = _is_mobile ? base_config.default_mobile_template_root : base_config.default_pc_template_root;

			/*
			 * 判断是否是模板内的文件路径，如果是，定向到模板路径
			 */
			if (req.path.indexOf("/app-pages/") !== -1) {

				res.bus_root = config.bus.root = res.template_root;
			} else {
				res.bus_root = config.bus.root = base_config.bus_root;
			}
		},
		// nunjucks_env: _build_nunjucks(base_config.bus_root),
		common_filter_handle: function(pathname, params, req, res) {
			if (!res.is_text) {
				return;
			}

			if (res.text_file_info.extname === ".html" && res.statusCode == 404 && fs.existsSync(res.template_root + "/pages" + pathname)) {
				console.log("前端自动二次路由，404 => 200")
				res.status(200); //找得到，不是真正的404
			}

			var body_ma5 = $$.md5(res.body);
			var template_map = this.template_map;
			var md5_map = this.md5_map;
			if (md5_map[pathname] !== body_ma5) { //MD5校验，如果文件已经发生改变，则清除模板重新编译
				template_map[pathname] = null;
			}
			//编译模板
			var tmp = template_map[pathname];
			if (!tmp) {
				tmp = template_map[pathname] = nunjucks.compile(res.body, _build_nunjucks(res.bus_root));
			}

			//请求 配置信息、商家信息
			var fiber = Fiber.current;
			_get_render_data_cache({
				type: "get-dotnar_render_data",
				host: req.headers["referer-host"],
				data_list: ["appConfig", "busInfo"],
				cookie: req.headers["cookie"]
			}, function(render_data) {
				try {
					res.body = tmp.render(render_data);
				} catch (e) {
					console.log("[Nunjucks Render Rrror]".colorsHead(), "=>", pathname, ">>", String(e), res.bus_root);
					res.body = "";
				}
				fiber.run();
			});
			Fiber.yield();
		}
	},
	lib: {
		root: base_config.lib_root,
		template_map: Object.create(null),
		md5_map: Object.create(null),
		nunjucks_env: _build_nunjucks(base_config.lib_root),
		common_filter_handle: function(pathname, params, req, res) {
			res.header("Access-Control-Allow-Origin", "*");
		},
		html_filter_handle: function(pathname, params, req, res) { //注入配置信息
			var body_ma5 = $$.md5(res.body);
			var template_map = this.template_map;
			var md5_map = this.md5_map;
			if (md5_map[pathname] !== body_ma5) { //MD5校验，如果文件已经发生改变，则清除模板重新编译
				template_map[pathname] = null;
			}
			//编译模板
			var tmp = template_map[pathname];
			if (!tmp) {
				tmp = template_map[pathname] = nunjucks.compile(res.body, this.nunjucks_env);
			}
			//请求 配置信息、商家信息
			var fiber = Fiber.current;
			_get_render_data_cache({
				type: "get-dotnar_render_data",
				host: req.headers["referer-host"],
				data_list: ["appConfigBase"],
				cookie: req.headers["cookie"]
			}, function(render_data) {
				res.body = tmp.render(render_data);
				fiber.run();
			});
			Fiber.yield();
		}
	}
};
module.exports = config;