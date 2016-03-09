var _nunjucks_env_map = new Map;
var _nunjucks_tmp_map = new Map;
var nunjucks = require("nunjucks");

function _build_nunjucks_env(key, pathname, args, cb) {
	var key = "BUS:" + pathname;
	if (_nunjucks_env_map.has(key)) {
		var nunjucks_env = _nunjucks_env_map.get(key);
	} else {

		nunjucks_env = nunjucks.configure(pathname, {
			watch: true,
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
		nunjucks_env._id = key;

		_nunjucks_env_map.set(key, nunjucks_env);
		cb && cb(nunjucks_env);
	}
	//动态绑定参数
	nunjucks_env.extend_args = args || {};
	return nunjucks_env;
};

function _build_bus_nunjucks_env(pathname, args) {

	return _build_nunjucks_env("BUS:" + pathname, pathname, args, function(nunjucks_bus_env) {
		nunjucks_bus_env.addFilter("dotnar_include", function(obj) {
			var paths;
			if (typeof obj === "string") {
				paths = [obj];
			} else if (Array.isArray(obj)) {
				paths = obj;
			} else {
				console.log("[Filter <include> Error]".colorsHead(), "type must be string or array");
				return "";
			}
			var _extend_args = nunjucks_bus_env.extend_args;
			paths.some(function(_include_file_path) {

			});
		});
	});
};
/*
 * 模板只与内容和env有关
 * TODO：增加ClockCache缓存系统的hot类型（定义一个缓存持续时间，一旦有访问，则重新计算这个时间）
 */
function _compile_nunjucks_tmp(content, env) {
	var _tmp_key = content + env._id;
	if (_nunjucks_tmp_map.has(_tmp_key)) {
		var nunjucks_tmp_info = _nunjucks_tmp_map.get(_tmp_key);
		if (nunjucks_tmp_info.md5 === $$.md5(content)) {
			var nunjucks_tmp = nunjucks_tmp_info.tmp;
		} else {
			_nunjucks_tmp_map.clear(_tmp_key);
		}
	}

	if (!nunjucks_tmp) {
		nunjucks_tmp = nunjucks.compile(content, env);
		_nunjucks_tmp_map.set(_tmp_key, {
			tmp: nunjucks_tmp,
			md5: $$.md5(content)
		});
	}
	return nunjucks_tmp;
};

module.exports = {
	buildEnv: _build_nunjucks_env,
	buildBusEnv: _build_bus_nunjucks_env,
	compileTemplate: _compile_nunjucks_tmp
};