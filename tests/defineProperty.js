var a = {

	get ['get a']() {
		Object.defineProperty(a, "a", { value: "zz" })
		return "AA"
	}
};

Object.defineProperty(a, "aa", {
	configurable: true,
	get: () => {
		/*this.get = () => {
			return "BO!"
		}*/
		delete a.aa
		Object.defineProperty(a, "aa", {
			value: "BO!"
		});
		return "QAQ"
	}
});

console.log(a.aa)
console.log(a.aa)
console.log(a.a)
console.log(a.a)
console.log(a)
