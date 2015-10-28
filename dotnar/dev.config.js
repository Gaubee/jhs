module.exports = {
	"lib_url": "http://lib.dev-dotnar.com",
	"domain": "dev-dotnar.com",
	"www_root": "E:/kp2/dotnar/public",
	"admin_root": "E:/kp2/admin_dotnar/public",

	"bus_root": "E:/kp2/gaubee_dotnar_base",
	"default_mobile_template_root": "E:/kp2/tegong_theme",
	"default_pc_template_root": "E:/kp2/pc_base_version",
	"bus_template_path_replace": [{
		from: "/usr/local/gitDepot/Gaubee/dotnar_tegong_theme",
		to: "E:/kp2/tegong_theme"
	}, {
		from: "/usr/local/gitDepot/Gaubee/dotnar_tegong_pc_theme",
		to: "E:/kp2/tegong_pc_theme"
	}, {
		from: "/usr/local/gitDepot/Gaubee/dotnar_base",
		to: "E:/kp2/gaubee_dotnar_base"
	}, {
		from: "/usr/local/gitDepot/xuezi/jewel",
		to: "E:/kp2/jewel"
	}, {
		from: "/usr/local/gitDepot/xuezi/base_version",
		to: "E:/kp2/NEW_DOTNAR_FONTEND/dotnar_base"
	}],

	"lib_root": "E:/kp2/O2O_front_end_lib",

	"tsc_sourceMap": true,

	"js_minify": false,
	"css_minify": false,
	"html_minify": false
}