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
	var tld = require("tldjs");
	var config = require("./config");

	jhs.on("before_filter", function(req, res) {
		// console.log(req);
		// console.log(req.headers.domain, config.domain);
		var _domain = tld.getDomain(req.headers.host)
		if (_domain === config.domain) {
			var _sub_domain = tld.getSubdomain(req.headers.host);
			// console.log(_sub_domain);
			if (_sub_domain === "" || _sub_domain === "www") {
				jhs.options = config.www;
			} else if (_sub_domain === "admin") {
				jhs.options = config.admin;
			} else if (_sub_domain === "lib") {
				jhs.options = config.lib;
			} else {
				jhs.options = config.bus;
			}
		} else {
			jhs.options = config.bus;
		}
	});

	function escapeRegExp(string) {
		return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	};

	function replaceAll(string, find, replace) {
		return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
	};
	jhs.filter("*.html", function(path, params, req, res) {
		res.body = res.body.toString().replace(/\{\%([\W\w]+?)\%\}/g, function(s, key) {
			return data[key] || ""
		});
		res.body = replaceAll(res.body, "__dotnar_lib_base_url__", "http://lib.dev-dotnar.com")
	});
	jhs.listen(10090, function() {
		console.log("Listen Start!");
	});
}