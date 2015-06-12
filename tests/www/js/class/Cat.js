define(function(require, exports, module) {
	module.exports = Cat;

	function Cat(name) {
		this.name = name
	};
	Cat.prototype.say = function(word) {
		console.log(word || "I'm " + this.name);
	};
});