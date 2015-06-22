require("./$.fs");
require("./$.String");
require("./$.Error");
var global_config;
var global_db;
var class_map = {};
var options = iClass.options = {
	suffix: [".class", ".cs"],
	extend_suffix: ["skill.js"], //拓展类的文件后缀
	cons_files: ["constructor.js", "_con.js", "Con.js"]
};
var class_map = iClass.class_map = iClass.$ = {};

function iClass(class_name) {
	if (arguments.length <= 1) {
		return iClass.get(class_name)
	} else {

		return iClass.set.apply(this, arguments);
	}
};
/*
 * 获取类
 */
iClass.require = iClass.get = function(class_name) {
	var _con_info = class_map[class_name];
	if (!_con_info) {
		ThrowError("Reference", "未定义 [" + class_name + "] 类");
	}
	return _con_info.con;
};
/*
 * 定义类
 */
var _base_time_id = +new Date("2015-1-1");
var _from_self = {};
iClass.conFactory = function() {
	var new_con = function(is_from_self, args) {
		if (is_from_self === _from_self) {
			return new_con._con.apply(this, args);
		} else {
			var result = new new_con(_from_self, Array.slice(arguments));
			return result;
		}
	};
	new_con.initClass = function(_con, extends_class, class_name) {
		new_con._con = _con;
		new_con.prototype = _con.prototype;
		//继承，只能继承单个类
		if (Function.isFunction(extends_class)) {
			var class_con = extends_class
		} else {
			class_con = class_map[extends_class];
			class_con && (class_con = class_con.con);
		}
		if (!Function.isFunction(class_con)) {
			class_con = null;
		} else {
			_con.prototype.__proto__ = class_con.prototype
		}
		//类的通用函数、对象
		_con.prototype.mix(iClass.conFactoryProto);
		_con.prototype.setUnEnum("class_name", class_name);
		var dbname = global_config.dbname[class_name];
		_con.prototype.setUnEnum("dbname", dbname);
		new_con.dbname = dbname;

		new_con._supers = class_con;
		new_con.super = function(instance, args) {
			return class_con.apply(instance, args);
		};
		new_con.get = function(_id) {
			var instance = db.find_by_id(dbname, _id);
			return new_con.getInstance(instance);
		};
		new_con.getInstance = function(obj) {
			if (obj) {
				obj.__proto__ = _con.prototype;
			}
			return obj;
		};
		new_con.hasById = function(_id) {
			return !!db.find_by_id(dbname, _id);
		};

		var dbIdPrefix = global_config.dbIdPrefix[class_name];
		new_con.getUuid = function(str) {
			return dbIdPrefix + (str || (new Date - _base_time_id).toString(36))
		};
	};
	return new_con;
};
iClass.conFactoryProto = {
	save: function() {
		var dbname = this.dbname;
		Function.isFunction(this.before_save) && this.before_save();
		if (dbname && this._id) {
			global_db.update(dbname, this._id, this);
		}
	},
	remove: function() {
		var dbname = this.dbname;
		Function.isFunction(this.before_remove) && this.before_remove();
		if (dbname && this._id) {
			global_db.remove(dbname, this._id);
		}
	}
};
//类定义
iClass.define = iClass.set = function(class_name, extends_class, _con_fun) {
	if (arguments.length < 2) {
		_con_fun = class_name;
		extends_class = null;
		class_name = ""; //匿名类
	} else if (arguments.length < 3) {
		_con_fun = extends_class;
		extends_class = null;
	}
	if (!String.isString(class_name)) {
		ThrowError("type", "iClass 错误的 class_name 对象类型");
	}
	if (!Function.isFunction(_con_fun)) {
		ThrowError("type", "iClass 错误的 constructor 对象类型");
	}
	if (class_name) {
		if (class_map[class_name]) { //已经定义过，当成是预定义
			var _con = class_map[class_name].con;
		} else {
			var _con = iClass.conFactory();
		}
		_con.initClass(_con_fun, extends_class, class_name);

		class_map[class_name] = {
			con: _con,
			sou_con: _con_fun,
			class_name: class_name,
			extends_class: extends_class
		};
	} else {
		var _con = iClass.conFactory();
		_con.initClass(_con_fun, extends_class, class_name);
	}
	return _con;
};
//类预定义
iClass.perdefine = function(class_name) {
	if (!String.isString(class_name)) {
		ThrowError("type", "iClass 错误的 class_name 对象类型");
	}
	if (!class_name) {
		ThrowError("class_name不可为空");
	}
	if (class_map[class_name]) { //已经定义过，当成是预定义
		ThrowError("类“{0}”已经被定义，无法进行预定义".format(class_name));
	}
	_con = iClass.conFactory();
	class_map[class_name] = {
		con: _con
	}
};
/*
 * 将一个文件夹当初类文件夹，尝试获取构造函数，如果没有，则返回默认的空构造函数
 */
function _try_require_constructor(class_pathname) {
	var _con;
	options.cons_files.some(function(cons_file_name) {
		try {
			//构造函数即使用了iClass.set来定义，但是还需要用exports来绑定到全局类中
			_con = require(class_pathname + "/" + cons_file_name);
			console.log("加载类构造函数：", cons_file_name);
		} catch (e) {
			if (e.code !== "MODULE_NOT_FOUND") {
				ThrowError(e);
			}
		}
	});
	return _con; //|| (_con = new Function("return " + iClass.emptyClass.toString())());
};
iClass.tryRequireConstructor = _try_require_constructor;
/*
 * 尝试获取类方法
 */
function _try_require_skill(class_pathname) {
	var files = fs.readdirSync(class_pathname);
	files.forEach(function(file) {
		if (
			options.extend_suffix.some(function(extend_suffix) {
				return file.endWith(extend_suffix)
			})
		) {
			var pathname = class_pathname + "/" + file;
			var stat = fs.lstatSync(pathname);
			//文件对象
			if (stat && !stat.isDirectory()) {
				require(pathname)
				console.log("加载类方法：　　", file);
			}
		}
	});
};
/*
 * 类初始化，根据传入的文件夹来进行整合
 */
iClass.init = function(floder_path) {

	global_config = require("../config/config");
	global_db = require("../db/index");
	iClass.db = global_db;
	iClass.config = global_config;

	var class_list = [];
	var files = fs.readdirSync(floder_path);
	files.forEach(function(file) {
		//.class或者.cs结尾的文件夹，默认为类文件夹
		var _end_with;
		if (
			options.suffix.some(function(suffix) {
				return file.endWith(suffix) && (_end_with = suffix)
			})
		) {
			var pathname = floder_path + "/" + file;
			var stat = fs.lstatSync(pathname);
			//目录对象
			if (stat && stat.isDirectory()) {
				class_list.push({
					suffix: _end_with,
					pathname: pathname,
					class_name: file.substr(0, file.length - _end_with.length)
				});
			}
		}
	});

	class_list.forEach(function(class_info) {
		console.log("预定义类[" + class_info.class_name + "]");
		iClass.perdefine(class_info.class_name);
	});

	//先把类加载进入。避免skill文件找不到class
	class_list.forEach(function(class_info) {
		var class_name = class_info.class_name;
		console.group("加载类[" + class_name + "]");
		var _con = _try_require_constructor(class_info.pathname);
		Function.isFunction(_con) && (class_map[class_name] = _con);
		_try_require_skill(class_info.pathname);
		console.groupEnd();
	});

};
/*
 * 拓展类的属性方法
 */
iClass.method = function(class_name, skill) {
	iClass.get(class_name).prototype.multiInherits(skill);
};


/*
 * 暴露到全局
 */
global.iClass = global.$C = iClass;