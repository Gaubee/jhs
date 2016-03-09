var init = require("./_init");
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
	return Promise.try((resolve, reject) => {
		console.flag("_get_render_data_cache", key);
		jhs.cache.getClockCache(key, function(data) {
			resolve(data)
		});
	});
};

function _get_template_info_cache(template_name, options) {
	var key = "template_paths_data:" + template_name;
	if (!jhs.cache.hasClockCache(key)) {
		jhs.cache.defineClockCache(key, "time", {
			get_value_handle: function(return_cb) {
				console.log("http://dotnar.com:7070/getInfoByTemplateName/" + template_name)
				$$.curl("http://dotnar.com:7070/getInfoByTemplateName/" + template_name).then(json_data => {
					return_cb(JSON.parse(json_data));
				});
			},
			time: 3800,
			debug: true
		});
	}

	return Promise.try((resolve, reject) => {
		jhs.cache.getClockCache(key, function(data) {
			resolve(data)
		});
	});
};

function _get_template_paths_cache(template_name, options) {
	return _get_template_info_cache(template_name, options).then(template_info => {
		// console.log(template_info);
		var relationPaths = template_info && template_info.relationPaths
		if (relationPaths && Array.isArray(options.template_path_replace)) {
			options.template_path_replace.forEach(function(template_path_info) {
				relationPaths = relationPaths.map(path => template_path_info.from == path ? template_path_info.to : path);
			});
			// console.log(relationPaths);
		}
		return relationPaths;
	});
};

module.exports = {
	getRenderData: _get_render_data_cache,
	getTemplateInfo: _get_template_info_cache,
	getTemplatePaths: _get_template_paths_cache,
};