var fs = require("fs");
var Fiber = require("fibers");
var path = require("path");
var base_config = require("./_base");
var common = require("./_common");
var NunBuilder = require("../nunjucks_builder");
var lib_nunjucks_env = NunBuilder.buildEnv("LIB_ENV", base_config.lib_root);

var lib_jhs_options = {
	"js_minify": base_config.js_minify,
	"css_minify": base_config.css_minify,
	"html_minify": base_config.html_minify,
	root: base_config.lib_root,
	common_filter_handle: function(pathname, params, req, res) {
		res.header("Access-Control-Allow-Origin", "*");
	},
	html_filter_handle: function(pathname, params, req, res) { //注入配置信息

		//请求 配置信息、商家信息
		var render_data = common.getRenderData({
			type: "get-dotnar_render_data",
			host: req.headers["referer-host"],
			data_list: ["appConfigBase"],
			cookie: req.headers["cookie"]
		});

		//编译模板
		var tmp = NunBuilder.compileTemplate(res.body, lib_nunjucks_env);

		//渲染文件
		try {
			res.body = tmp.render(render_data);
		} catch (e) {
			console.log("[Nunjucks Render Error]".colorsHead(), "=>", pathname, ">>", String(e));
			res.status(502);
			res.body = "";
		}
	}
};
module.exports = lib_jhs_options;