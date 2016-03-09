require("gq-core")
console.log(`// AMD support
						if (typeof define === 'function' && define.amd) {
							define("$-{exports_name}",$-{deps}, function() {
								return $-{variable_name} ;
							});
							// CommonJS/Node.js support
						} else if (typeof exports === 'object') {
							if (typeof module === 'object' && typeof module.exports === 'object') {
								exports = module.exports = $-{variable_name} ;
							}
							exports.$-{exports_name} = $-{variable_name} ;
						} 
						window.$-{exports_name} = $-{variable_name} ;
						//EXPORT END
						`.replaceAll("						", ""))