var http = require("http");

http.get("http://127.0.0.1:12345/online/qtsdkrepository/windows_x86/root/qt/Updates.xml", function(req, res) {
	// console.log(req)
})
http.get("http://mirrors.hust.edu.cn/qtproject/online/qtsdkrepository/windows_x86/root/qt/Updates.xml", function(res) {

	var l = 0
	console.log(res)
	res.on("data", (chunk) => {
		l += chunk.length
		console.log(l, chunk)
	});
})