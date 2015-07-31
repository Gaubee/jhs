var $Object = require("./$.Object");
var fs = require("fs");
var tld = require('tldjs');

var folder_name_reg = /^[^\\\.\/\:\*\?\”\|]{1}[^\\\/\:\*\?\”\|]{0,200}$/;
/*
根据〖中华人民共和国国家标准 GB 11643-1999〗中有关公民身份号码的规定，公民身份号码是特征组合码，由十七位数字本体码和一位数字校验码组成。排列顺序从左至右依次为：六位数字地址码，八位数字出生日期码，三位数字顺序码和一位数字校验码。
    地址码表示编码对象常住户口所在县(市、旗、区)的行政区划代码。
    出生日期码表示编码对象出生的年、月、日，其中年份用四位数字表示，年、月、日之间不用分隔符。
    顺序码表示同一地址码所标识的区域范围内，对同年、月、日出生的人员编定的顺序号。顺序码的奇数分给男性，偶数分给女性。
    校验码是根据前面十七位数字码，按照ISO 7064:1983.MOD 11-2校验码计算出来的检验码。

出生日期计算方法。
    15位的身份证编码首先把出生年扩展为4位，简单的就是增加一个19或18,这样就包含了所有1800-1999年出生的人;
    2000年后出生的肯定都是18位的了没有这个烦恼，至于1800年前出生的,那啥那时应该还没身份证号这个东东，⊙﹏⊙b汗...
下面是正则表达式:
 出生日期1800-2099  (18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])
 身份证正则表达式 /^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i            
 15位校验规则 6位地址编码+6位出生日期+3位顺序号
 18位校验规则 6位地址编码+8位出生日期+3位顺序号+1位校验位
 
 校验位规则     公式:∑(ai×Wi)(mod 11)……………………………………(1)
                公式(1)中： 
                i----表示号码字符从由至左包括校验码在内的位置序号； 
                ai----表示第i位置上的号码字符值； 
                Wi----示第i位置上的加权因子，其数值依据公式Wi=2^(n-1）(mod 11)计算得出。
                i 18 17 16 15 14 13 12 11 10 9 8 7 6 5 4 3 2 1
                Wi 7 9 10 5 8 4 2 1 6 3 7 9 10 5 8 4 2 1

*/
//身份证号合法性验证 
//支持15位和18位身份证号
//支持地址编码、出生日期、校验位验证
function IdentityCodeValid(code) {
    var city = {
        11: "北京",
        12: "天津",
        13: "河北",
        14: "山西",
        15: "内蒙古",
        21: "辽宁",
        22: "吉林",
        23: "黑龙江 ",
        31: "上海",
        32: "江苏",
        33: "浙江",
        34: "安徽",
        35: "福建",
        36: "江西",
        37: "山东",
        41: "河南",
        42: "湖北 ",
        43: "湖南",
        44: "广东",
        45: "广西",
        46: "海南",
        50: "重庆",
        51: "四川",
        52: "贵州",
        53: "云南",
        54: "西藏 ",
        61: "陕西",
        62: "甘肃",
        63: "青海",
        64: "宁夏",
        65: "新疆",
        71: "台湾",
        81: "香港",
        82: "澳门",
        91: "国外 "
    };
    var tip = "";
    var pass = true;

    if (!code || !/^\d{6}(18|19|20)?\d{2}(0[1-9]|1[12])(0[1-9]|[12]\d|3[01])\d{3}(\d|X)$/i.test(code)) {
        tip = "身份证号格式错误";
        pass = false;
    } else if (!city[code.substr(0, 2)]) {
        tip = "地址编码错误";
        pass = false;
    } else {
        //18位身份证需要验证最后一位校验位
        if (code.length == 18) {
            code = code.split('');
            //∑(ai×Wi)(mod 11)
            //加权因子
            var factor = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
            //校验位
            var parity = [1, 0, 'X', 9, 8, 7, 6, 5, 4, 3, 2];
            var sum = 0;
            var ai = 0;
            var wi = 0;
            for (var i = 0; i < 17; i++) {
                ai = code[i];
                wi = factor[i];
                sum += ai * wi;
            }
            var last = parity[sum % 11];
            if (parity[sum % 11] != code[17]) {
                tip = "校验位错误";
                pass = false;
            }
        }
    }
    return tip || pass;
};
/*
目前，我国使用的手机号码为11位，其中各段有不同的编码方向：前3位———网络识别号；第4-7位———地区编码；第8-11位———用户号码。

--------------------------

#13,158,159开头
/^(?:13\d|15[89])-?\d{5}(\d{3}|\*{3})$/


#13,14,15,18开头
/^(?:13\d|14|15|18)-?\d{5}(\d{3}|\*{3})$/

电话和手机号码格式验证：（021-xxxx, 139xx）
regex: /(^[0-9]{3,4}\-[0-9]{7,8}$)|(^[0-9]{7,8}$)|(^\([0-9]{3,4}\)[0-9]{3,8}$)|(^0{0,1}13[0-9]{9}$)/

手机号验证：
13,158, 159
/^(?:13\d|15[89])-?\d{5}(\d{3}|\*{3})$/

13,15,18
/^1[3|5|8][0-9]\d{4,8}$/

---------------------------------------------

js正则验证输入是否为手机号码或电话号码

首先给出原文链接：http://www.cnblogs.com/cxy521/archive/2008/06/05/1214624.html

 
验证手机号码正则表达式：/^(?:13\d|15[89])-?\d{5}(\d{3}|\*{3})$/

验证电话号码正则表达式：/^(([0\+]\d{2,3}-)?(0\d{2,3})-)(\d{7,8})(-(\d{3,}))?$/
*/
var phone_pattern_reg = /(^(([0\+]\d{2,3}-)?(0\d{2,3})-)(\d{7,8})(-(\d{3,}))?$)|(^0{0,1}1[3|4|5|6|7|8|9][0-9]{9}$)/;
/*
邮箱验证，来自sina-weibo的脚本
http://js.t.sinajs.cn/t5/register/js/page/register/email.js?version=3c1867588e99a11e
*/
var isEmail = function(a) {
    if (!/^[0-9A-z_][_.0-9A-z-]{0,31}@([0-9A-z][0-9A-z-]{0,30}\.){1,4}[A-z]{2,4}$/.test(a)) return !1;
    if (a && a != "" && a.indexOf("@") != -1) {
        var b = a.indexOf("@"),
            c = a.substring(0, b);
        return c.length > 64 || a.length > 256 ? !1 : !0
    }
    return !1
}

var searchWeight = function(str, key) {
    str = str.toLowerCase();
    key = key.toLowerCase();
    if (str.indexOf(key) !== -1) {
        return str.split(key).length * 10;
    } else {
        var result = 0;
        for (var i = 0, c; c = key[i]; i += 1) {
            if (" ！@#￥%…&*（）{}：“《》。，’‘”；【】？\<\>\/\[\]\:\"\;\'\,\.\?\!\$\^".indexOf(c) === -1) {
                result += str.split(c).length - 1;
            }
        }
        return result;
    }
};
/*MD5*/
var crypto = require("crypto");

function md5(str) {
    var md5sum = crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
};
//通用密码的加密算法，基于MD5
function _build_2_md5(pwd_str) {
    //固定字符串
    var _key = "Gaubee";
    //初次不可逆加密
    var md5Hax = md5(pwd_str);
    //双倍长度混合固定字符串再次加密，MD5暴力破解库与密码无法对应
    md5Hax = md5(md5Hax + md5Hax + _key);
    //最后一次加密，双倍MD5长度，64位，不知道算法细节的人完全无法使用正常MD5库进行暴力破解
    var result = md5Hax + md5(md5Hax + pwd_str);
    return result;
};
//不重复的ID
var _base_time_id = +new Date("2015-1-1");

function uuid(prefix) {
    return (prefix || "") + Math.random().toString(36).substr(2) + (new Date - _base_time_id).toString(36)
};

var Tools = {
    "name": function(name, type) {
        type || (type = "名字");
        if (name.replace(/[a-z0-9\.\-\_]/ig, "") !== "") {
            throw type + "中不可出现：字母、数字、点、减号、下划线以外的字符";;
        }
        if (/(\.|\-|\_)/.test(name[0])) {
            throw type + "中 点、减号、下划线不可作为第一个字符出现";
        }
        if (/(\.|\-|\_){2,}/.test(name)) {
            throw type + "中 点、减号、下划线不可连续出现";
        }
        return name.length < 12;
    },
    "folder_name": function(name) {
        return folder_name_reg.test(name);
    },
    "id_card": IdentityCodeValid,
    "phone": function(phone_number) {
        return phone_pattern_reg.test(phone_number);
    },
    "isEmail": isEmail,
    "search": searchWeight,
    "boolean_parse": function(boolean_str) {
        if (boolean_str && boolean_str === "false") {
            boolean_str = false;
        } else if (boolean_str) {
            boolean_str = true;
        } else {
            boolean_str = false;
        }
        return boolean_str;
    },
    "isUrl": function(url) {
        return tld.isValid(url);
    },
    md5_2: _build_2_md5,
    md5: md5,
    uuid: uuid,
    isMobile: function(userAgent) {
        userAgent = userAgent.toLowerCase();
        var mobileAgent = ["nokia", "iphone", "android", "motorola", "^mot-", "softbank", "foma", "docomo", "kddi", "up.browser", "up.link", "htc", "dopod", "blazer", "netfront", "helio", "hosin", "huawei", "novarra", "CoolPad", "webos", "techfaith", "palmsource", "blackberry", "alcatel", "amoi", "ktouch", "nexian", "samsung", "^sam-", "s[cg]h", "^lge", "ericsson", "philips", "sagem", "wellcom", "bunjalloo", "maui", "symbian", "smartphone", "midp", "wap", "phone", "windows ce", "iemobile", "^spice", "^bird", "^zte-", "longcos", "pantech", "gionee", "^sie-", "portalmmm", "jigs browser", "hiptop", "^benq", "haier", "^lct", "operas*mobi", "opera*mini", "mobile", "blackberry", "IEMobile", "Windows Phone", "webos", "incognito", "webmate", "bada", "nokia", "lg", "ucweb", "skyfire", "ucbrowser"];
        var isMobile = false;
        for (var i = 0; i < mobileAgent.length; i++) {
            if (userAgent.indexOf(mobileAgent[i]) != -1) {
                isMobile = true;
                break;
            }
        }
        return isMobile;
    },
    isWeiXin: function(userAgent) {
        return (/MicroMessenger/i).test(userAgent);
    }
};

global.Tools = global.$$ = Tools;

/*test*/
// var md5_str = $$.md5("呵呵哈哈");
// console.log(md5_str = md5_str.substring(0, 6));
// console.log(parseInt(md5_str, 16));