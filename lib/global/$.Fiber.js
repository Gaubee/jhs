var Fiber = require('fibers');
var http = require("http");
var https = require("https");

global.curl = function(url) {
	var fiber = Fiber.current;
	var result = "";
	var handle = http;
	if (url.indexOf("https://") === 0) {
		handle = https;
	}
	handle.get(url, function(res) {
		res.on("data", function(chunk) {
			result += chunk;
		}).on("end", function() {
			//继续
			fiber.run();
		})
	});
	Fiber.yield(); //挂起
	return result
};
global.FiberRun = function(foo) {
	Fiber(foo).run();
};
global.Fiber = Fiber;
/*TEST*/
// FiberRun(function() {
// 	var data = '';
// 	var is_end;
// 	var fiber;
// 	setTimeout(function() {
// 		data = "hahah";
// 		is_end = true;
// 		fiber && fiber.run();
// 	}, 1000);
// 	var a = {};
// 	a.__defineGetter__("rawBody", function() {
// 		if (!is_end) {
// 			fiber = Fiber.current;
// 			Fiber.yield();
// 		}
// 		return data;
// 	});

// 	console.log(a);
// 	console.log(a.rawBody);
// });