var cluster = require('cluster');
if (cluster.isMaster) {
	var numCPUs = 1 || require('os').cpus().length;
	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on('exit', function(worker, code, signal) {
		console.log('worker ' + worker.process.pid + ' died');
	});
} else {
	var sjsc = require('sockjs-client');
	var client = sjsc("http://dev.dotnar.com:3000/sock_notify");
	var jhs = require("./index");
	jhs.options.root = __dirname + "/tests/www/";
	jhs.listen(10090, function() {
		console.log("Listen Start!");
	});
	var data = {
		title: "TEMPLATE TEST",
		name: "模板测试"
	}
	jhs.filter("*.html", function(path, params, req, res) {
		res.body = res.body.toString().replace(/\{\%([\W\w]+?)\%\}/g, function(s, key) {
			return data[key] || ""
		});
	});
}