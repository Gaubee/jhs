require("./$.Object");
//字符串拼接
String.prototype.setUnEnum("format", function(args) {
	var result = this;
	if (arguments.length > 0) {
		if (arguments.length == 1 && typeof(args) == "object") {
			for (var key in args) {
				if (args[key] != undefined) {
					var reg = new RegExp("({" + key + "})", "g");
					result = result.replace(reg, args[key]);
				}
			}
		} else {
			for (var i = 0; i < arguments.length; i++) {
				if (arguments[i] != undefined) {
					//var reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题，谢谢何以笙箫的指出
					　　　　　　　　　　　　
					var reg = new RegExp("({)" + i + "(})", "g");
					result = result.replace(reg, arguments[i]);
				}
			}
		}
	}
	return result;
});
//解析成Object
String.prototype.setUnEnum("parseJSON", function() {
	return JSON.parse(this);
});

String.prototype.setUnEnum("startWith", function(str) {
	return this.indexOf(str) === 0;
});
String.prototype.setUnEnum("endWith", function(str) {
	var index = this.indexOf(str);
	return index >= 0 && index === this.length - str.length;
});

//类型判断
String.isString = function(str) {
	return typeof str === "string";
};

//转驼峰
String.prototype.setUnEnum("camelize", function() {
	//转换为驼峰风格
	if (this.indexOf("-") < 0 && this.indexOf("_") < 0 && this.indexOf(".") < 0) {
		return this
	}
	return this.replace(/[-_.][^-_.]/g, function(match) {
		return match.charAt(1).toUpperCase()
	})
});

//数字化
String.prototype.setUnEnum("toInt", function(n) {
	return parseInt(this, n);
});
String.prototype.setUnEnum("toFloat", function(n) {
	return parseFloat(this, n);
});

//替换全部

function escapeRegExp(string) {
	return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
};
String.replaceAll = function(string, find, replace) {
	return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
};
String.prototype.setUnEnum("replaceAll", function(find, replace) {
	return String.replaceAll(this, find, replace);
});