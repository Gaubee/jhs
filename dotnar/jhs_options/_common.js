var init = require("./_init");
var Fiber = require("fibers");
var http = require("http");

function _get_render_data_cache(options) {
	var app = init.app;
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
	var fiber = Fiber.current;
	jhs.cache.getClockCache(key, function(data) {
		fiber.run(data)
	});
	return Fiber.yield();
};

function _get_template_info_cache(template_name) {
	var key = "template_paths_data:" + template_name;
	if (!jhs.cache.hasClockCache(key)) {
		jhs.cache.defineClockCache(key, "time", {
			get_value_handle: function(return_cb) {
				var json_data = curl("http://dotnar.com:7070/getInfoByTemplateName/" + template_name);
				return_cb(JSON.parse(json_data));
			},
			time: 3800,
			debug: true
		});
	}
	var fiber = Fiber.current;
	jhs.cache.getClockCache(key, function(data) {
		fiber.run(data)
	});
	return Fiber.yield();
};

function _get_template_paths_cache(template_name) {
	var template_info = _get_template_info_cache(template_name);
	return template_info && template_info.relationPaths
};

module.exports = {
	getRenderData: _get_render_data_cache,
	getTemplateInfo: _get_template_info_cache,
	getTemplatePaths: _get_template_paths_cache,
};