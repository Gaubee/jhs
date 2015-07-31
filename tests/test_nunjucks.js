var nunjucks = require("nunjucks");
require("../lib/global");
// var env = nunjucks.configure( {
// 	watch: false, //不配置的话，会导致watch文件而不结束进程
// 	tags: {
// 		blockStart: '<%',
// 		blockEnd: '%>',
// 		variableStart: '<$',
// 		variableEnd: '$>',
// 		commentStart: '<-#',
// 		commentEnd: '#->'
// 	},
// });
var env = nunjucks.configure(__dirname + "\\www", {
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
var str = 'Hello <$ username $> <% include "template.html" %>';
// str = str + str + str + str + str;
// str = str + str + str + str + str;
// console.log(str);
// console.time("compile");
// for (var i = 10000; i >= 0; i--) {
var tmp1 = nunjucks.compile(str, env);
// };
// console.timeEnd("compile");

// console.time("compile");
// for (var i = 10000; i >= 0; i--) {
// 	$$.md5(str)
// };
// console.timeEnd("compile");


var res1 = tmp1.render({
	username: 'James',
});
var res2 = tmp1.render({
	username: 'James2',
});
console.log(res1);
console.log(res2);


// console.log(nunjucks.renderString('Hello <$ username $>', {
// 	username: "Gaubee"
// }));


// var fs =require("fs");

// var str_2 = fs.readFileSync("E:/kp2/O2O_fontend/public/main-beta.html").toString()
// console.log(nunjucks.renderString(str_2, {
// 	username: "Gaubee"
// }));