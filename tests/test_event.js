var jhs = require("../index");
jhs.on("test", function(str) {
	console.log("Emit test:", str);
});
jhs.emit("test", "Hello World");