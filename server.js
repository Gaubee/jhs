const jhs = require("./index.js");
const default_root = [__dirname + "/tests/default_server/", __dirname + "/tests/default_server_base/"]
Object.keys(process.env).forEach((_key) => {
    var key = _key.toLowerCase();
    if (!key.startWith("jhs_")) {
        return
    }
    key = key.substr(4);
    var env_value = process.env[_key];
    switch (key) {
        case "root":
            jhs.options.root = env_value.split(";").filter(path => path);
            if (jhs.options.root.length === 0) {
                jhs.options.root = default_root
            }
            break;
        case "index":
        case "404":
        case "css_minify":
        case "js_minify":
            jhs.options[key] = env_value;
            break;
    }
});

jhs.options.root = default_root;
jhs.options.index = "index.html";


jhs.listen(10101, function() {
    console.log("默认服务器已经启动!");
});
