const jhs = require("./index.js");

jhs.options.root = [__dirname + "/tests/default_server/"];
jhs.options.index = "index.html";

jhs.listen(10101, function() {
    console.log("默认服务器已经启动!");
});
