var jhs = require("../index");
jhs.options.root = __dirname + "/www/";

jhs.listen(10090, function() {
	console.log("Listen Start!");
});
var data = {
	title: "TEMPLATE TEST",
	name: "模板测试"
}
jhs.filter("*.html", function(path, params, req, res) {
	res.body = res.body.replace(/\{\%([\W\w]+?)\%\}/g, function(s, key) {
		return data[key] || ""
	});
});