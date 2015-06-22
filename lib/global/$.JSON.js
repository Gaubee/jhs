require("./$.Array");
require("./$.Object");
/*
 * 规定一种把数据格式化成安全的JSON字符串，从而发送给请求
 */
//统一的过滤机制
var _filter_nojson_able_keys = function(key, obj) {
	if (obj) {
		var nojson_able_keys = obj.__nojson_able_keys__;
		var new_obj = obj instanceof Array ? [] : {};
		if (nojson_able_keys instanceof Array) {
			for (var i in obj) { //将数据从黑名单里面排除
				if (nojson_able_keys.indexOf(i) === -1) {
					new_obj[i] = obj[i];
				}
			}
			//返回过滤后的数据集合
			return new_obj;
		} else {
			for (var i in obj) {
				new_obj[i] = obj[i];
			}
		}
	}
	return obj
};
JSON._stringify = JSON.stringify;
JSON.stringifySecurity = function(obj, handle) {
	var arg = Array.prototype.slice.call(arguments);
	if (!handle) {
		arg[1] = _filter_nojson_able_keys;
	}
	return JSON._stringify.apply(JSON, arg);
};
Object.prototype.setUnEnum("addSecurityKey", function(key) {
	if (!(this.__nojson_able_keys__ instanceof Array)) {
		Object.defineProperty(obj.info, "__nojson_able_keys__", {
			//不可遍历，自身不会被JSON序列化
			enumerable: false,
			value: []
		});
	}
	this.__nojson_able_keys__.push(key);
});
Object.prototype.setUnEnum("removeSecurityKey", function(key) {
	if (this.__nojson_able_keys__ instanceof Array) {
		//由$.Array.js拓展而来
		this.__nojson_able_keys__.remove(key);
	}
});