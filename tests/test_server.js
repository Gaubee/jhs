// var jhs = require("../index");
// jhs.options.root = __dirname + "/www/";
// jhs.options.root = ["E:/Git/qzly"];
// jhs.options.index = "loader.html";

// jhs.listen(10090, function() {
// 	console.log("Listen Start!");
// });
// // var data = {
// // 	title: "TEMPLATE TEST",
// // 	name: "模板测试"
// // }
// jhs.on("*.html", function(path, params, req, res) {
// 	res.body = res.body.pipe(jhs.replaceStream("__dotnar_lib_base_url__", "http://dev.dotnar.com:2221"));
// });

process.gq_config = {
	// silence_log:true
}

var jhs = require("jhs");
const path = require("path")
const url = require("url")
// jhs.options.root = ["http://download.qt.io/"];
jhs.options.root = ["http://mirrors.hust.edu.cn/qtproject/"];
// jhs.on("before_filter", function(req, res) {
// 	// 大文件，7z格式，走代理
// 	if (path.extname(url.parse(req.decode_pathname).pathname) === ".7z") {
// 		req.decode_pathname = req.decode_pathname.replace("http://download.qt.io", "http://mirrors.hust.edu.cn/qtproject")
// 		req.jhs_options = {
// 			root: ["http://mirrors.hust.edu.cn/qtproject/"]
// 		}
// 	}
// });
jhs.listen("12345", function() {
	console.log("ok")
});