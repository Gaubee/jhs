require("gq-core/Tools");
const default_root = [__dirname + "/tests/default_server/", __dirname + "/tests/default_server_base/"]
const default_port = 80
const options = {};
options.root = default_root;
options.index = "index.html";
options.port = default_port;

Object.keys(process.env).forEach((_key) => {
    var key = _key.toLowerCase();
    if (!key.startsWith("jhs_")) {
        return
    }
    key = key.substr(4);
    var env_value = process.env[_key];
    switch (key) {
        case "root":
            options.root = env_value.split(";").filter(path => path);
            if (options.root.length === 0) {
                options.root = default_root
            }
            break;
        case "index":
        case "404":
        case "css_minify":
        case "js_minify":
            options[key] = env_value;
            break;
        case "port":
            options[key] = ~~env_value || default_port;
            break;
        case "silence_log":
            (process.gq_config || (process.gq_config = {}))[key] = $$.boolean_parse(env_value);
            break;
    }
});

const jhs = require("./index.js");
jhs.options = options;
jhs.listen(options.port, function() {
    console.log("默认服务器已经启动!");
});
