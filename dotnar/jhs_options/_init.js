var client_id = $$.uuid("CLIENT_"); //TCP数据的分割标识
function init(app) {
	init.app = app;
	var bufferList = [];
	var conn = app.server_conn;
	conn.on("data", function(data) {
		data = data.toString();
		// console.log(data);
		bufferList.push(data);
		//发现结束符，开始解析
		if (data.indexOf(conn.client_id) !== -1 || (bufferList[bufferList.length - 2] + data).indexOf(conn.client_id) !== -1) {//分割符可能分在上下两个数据区间
			conn.emit("data-parser")
		}
	});
	conn.client_id = client_id;

	conn.on("data-parser", function() {
		var data = bufferList.join("");
		var index = data.indexOf(conn.client_id);
		var left_data = data.substr(0, index);
		var right_data = data.substr(index + conn.client_id.length);
		conn.emit("data-end", left_data);

		bufferList = [];
		bufferList.push(right_data);
		if (right_data.indexOf(conn.client_id) !== -1) {
			conn.emit("data-parser")
		}
	});
	conn.on("data-end", function(data) {
		try {
			data = JSON.parse(data.toString());
		} catch (e) {
			console.log("data:", data.toString());
			throw e;
		}
		// console.log(data);
		if (data.response_id) {
			app.emit("res:" + data.response_id, data.error, data);
		}
	});
	conn.send = function(data) {
		if (!conn.client_id) {
			console.error("客户端未初始化，无法返回数据");
		} else {
			conn.write(data + conn.client_id);
		}
	};
	//初始化模式不需要发送结束标识，否则无法解析
	app.server_conn.write(JSON.stringify({
		type: "init",
		client_id: client_id
	}));
	app.once("res:server_socket-init", function() {
		console.log("初始化连接成功");
	});
};
module.exports = init;