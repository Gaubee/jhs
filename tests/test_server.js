var jhs = require("../index");
jhs.options.root = __dirname + "/www/";
jhs.options.root = ["E:/Git/qzly"];
jhs.options.index = "loader.html";

jhs.listen(10090, function() {
	console.log("Listen Start!");
});
// var data = {
// 	title: "TEMPLATE TEST",
// 	name: "模板测试"
// }
jhs.on("*.html", function(path, params, req, res) {
	res.body = res.body.pipe(jhs.replaceStream("__dotnar_lib_base_url__", "http://dev.dotnar.com:2221"));
});