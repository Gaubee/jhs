var TypeScriptSimple = require('typescript-simple').TypeScriptSimple;
var fs = require("fs");
var path = require("path");
var file_name = path.normalize(__dirname + "/www/ts/main.ts");
var file_content = fs.readFileSync(file_name).toString();
var file_path = path.parse(file_name).dir;
console.log(file_path, file_name);

var tss = new TypeScriptSimple({
	sourceMap: true
});

var js =  tss.compile(file_content, file_name);
console.log(js)