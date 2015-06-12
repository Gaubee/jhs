var jhs = require("../index");
jhs.options.root = __dirname + "/www/";
console.log(jhs.options.root);
jhs.listen(10090, function() {
	console.log("Listen Start!");
});