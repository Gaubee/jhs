var filetype = require("../lib/filetype");
var fs = require("fs");
// var file = fs.readFileSync("E:/kp2/NEW_DOTNAR_FONTEND/dotnar_base/font/fontello.eot");
var file = fs.readFileSync("E:/kp2/O2O_front_end_lib/font_lib/xx.eot");
var buf = file;

console.log(buf[34], 0x4C, '&&', buf[35], 0x50, '&&',
	//
	[
		//
		[buf[8], 0x02, '&&', buf[9], 0x00, '&&', buf[10], 0x01],
		//
		'||',
		//
		[buf[8], 0x01, '&&', buf[9], 0x00, '&&', buf[10], 0x00],
		//
		'||',
		//
		[buf[8], 0x01, '&&', buf[9], 0x00, '&&', buf[10], 0x02],
		//
		'||',
		//
		[buf[8], 0x02, '&&', buf[9], 0x00, '&&', buf[10], 0x02]
		//
	]
	//
)

console.log(filetype(file))