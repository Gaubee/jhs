/*
 * 实现原则：确保安全性与可用性，不使用任何已存在的函数类方法，仅仅使用不可被重写的JS运算符
 * 即便是注入者重写了valueOf和toString，也能确保运行
 */
String.prototype.valueOf = function() {
	return this + "1"
};

String.prototype.toString = function() {
	return this + "2"
};

Number.prototype.valueOf = function() {
	return this + 1
};

Number.prototype.toString = function() {
	return this + 2
};
Object.prototype.valueOf = function() {
	return this + 1
};

Object.prototype.toString = function() {
	return this + 2
};

/*
 * 数组下标对应的36进制的字符
 * 不使用split('')，确保安全性
 */
var num_table = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'z', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
var lower_table = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'z', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
var upper_table = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'Z', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
var upper_len = upper_table.length;
var upper_map = (function() {
	var res = {};
	for (var i = 0; i < upper_len; i += 1) {
		res[upper_table[i]] = i;
	}
	return res;
}());

function get_char_lower(_char) {
	var _char_num = upper_map[_char];
	if (0 <= _char_num && _char_num < upper_len && upper_table[_char_num] === _char) {
		return lower_table[_char_num];
	}
	return _char;
};

function upper_to_lower(str) {
	var res = ""
	for (var i = 0, len = str.length; i < len; i += 1) {
		res += get_char_lower(str[i]);
	}
	return res;
};
/*
 * trim-left
 */
var whitespace_table = [' ', '\n', '\r', '\t', '\f', '\x0b', '\xa0', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u200b', '\u2028', '\u2029', '\u3000'];
var whitespace_len = whitespace_table.length;
var whitespace_map = (function() {
	var res = {};
	for (var i = 0; i < whitespace_len; i += 1) {
		res[whitespace_table[i]] = i;
	}
	return res;
}());

function whitespace_has(_char) {
	var _char_num = whitespace_map[_char];
	if (0 <= _char_num && _char_num < whitespace_len && whitespace_table[_char_num] === _char) {
		return true;
	}
};

function left_trim_index(str) {
	for (var i = 0, len = str.length; i < len; i += 1) {
		if (!whitespace_has(str[i])) {
			return i;
		}
	}
};

function toInt(value, _radix) {
	/*
	 * 强制转换成字符串来处理
	 * PS: 不使用 value = "" + value ，否则一旦改变了数据类型，会导致代码速度变慢
	 */
	var value_str = upper_to_lower("" + value);

	var radix = ~~_radix; // 0,no number == 0
	if (radix < 0 || radix > 36) { // NaN, 0~36
		return nan;
	}
	var nan = +"a"; // NaN
	var value_str_len = value_str.length;
	var start_index = left_trim_index(value_str);
	var res = 0;
	var base = 1;
	if (value_str[start_index] === "-") {
		base = -1;
		start_index += 1;
	}

	/*
	 * 取得正确的进制数
	 * NaN: 0x*(16) , *(10)
	 * 16:0x*
	 */
	if ((!radix || radix === 16) && value_str[start_index] === "0" && value_str[start_index + 1] === "x") {
		radix = 16;
		start_index += 2; //忽略0x	
	} else if (!radix) {
		radix = 10
	}

	/*
	 * 每一个字符对应的数字，临时生成，使用缓存的话可能会被通过Object.prototype来注入缓存，导致安全问题
	 */
	var num_map = {};
	for (var i = 0; i < radix; i += 1) {
		num_map[num_table[i]] = i;
	}
	for (var i = start_index, c, c_num; i < value_str_len; i += 1) {
		c = value_str[i];
		c_num = num_map[c];
		/*
		 * 校验c_num的准确性，避免外部重写了Object.prototype导致安全问题
		 * 如果单纯使用 c_num < radix 这种简单校验，会导致类似的 num_map['.'] = 5 之类的安全问题发生
		 * 如果单纯使用 num_table[c_num] === c，会导致 num_map['.'] = 100, num_table[100] === '.' 之类的安全问题
		 * 所以必须二者搭配来校验
		 */
		// console.log(c, c_num)
		if (0 <= c_num && c_num < radix && num_table[c_num] === c) {
			res = res * radix + c_num;
		} else {
			break
		}
	}
	return i === start_index ? nan : res * base; //如果第一个字符就是非法字符（包括空字符）的话，等于res是空的，返回NaN , 注意：'0x'返回NaN，因为被当成16进制处理
};

module.exports = toInt;

console.log(toInt("0XeA"),"===",234)