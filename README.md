# JH

> 一个提供访问编译功能静态文件服务

## 需要注意

路由分两种：**文件**、**目录**。 如果你的文件没有后缀，那么是无法访问到这个文件的，他会被当成是目录来进行访问，访问目录下的`index.html`。

如果ROOT提供的是HTTP协议，那么要注意URL-pathname中的多个`/、\\`会被当成一个`/`来处理：
```
"http://a.com/////a//c.b.js" ==> "http://a.com/a/c/b.js"
```

`JHS`代表`JH-Server`，是程序核心

## 如何加载编译后的文件

提供了Sass、Less、TypeScriptd等语言的编译，访问的时候需要加上参数：`compile_to`。比如：
```
curl http://localhost/test.less?compile_to=.css
```

## 实现自定义路由

`JHS`的options是可以动态更改的，从而动态更改一次请求的路由：
```js
// 通过ON事件监听，可以返回一个Promise对象，从而控制执行流程
jhs.on("before_filter", co.wrap(function*(req, res) {
    if(req.path.entWiht(".js")){
        req.jhs_options = {root : __dirname+"/other_js/"};
    }
}));
jhs.on("*.js",co.wrap(function*(req, res){
    
}));
```

# TODO

## 如何安装

1. 分步按需安装：
```shell
# 安装主模块
npm install jh -g

# 搭建服务，这里会将全局的jh下的jhs文件夹拷贝到node_modules下，安装依赖并保持到package.json中
cd project-folder && jh init

# 安装需要的编译模块
jh install less
jh install sass # 默认指定sass.js
jh install libsass # 如果安装了libsass，sass编译的时候会选择libsass
jh install ts # typescript-simple
jh install babel
jh install live # live-reload
jh install all # 全部模块

# 查看当前目录已经安装的模块
jh ls
#> ^2.0.0 jh
#> ^3.3.7 clean-css
#> ^2.5.3 less
#> ^3.2.0 node-sass
#> ^3.0.2 typescript-simple

# 拷贝出一次安装的命令
jh copy
#> npm install --save jh^2.0.0 --m:less^2.5.3,sass^3.2.0,ts^3.0.2
# 不带版本号的安装命令
jh copy new
#> npm install --save jh --m:less,sass,ts

# 启动默认服务，端口号：10090
jh server
# 自定义端口号
jh server -p:80
```
2. 一次性安装，适用于服务端部署：
```shell
# 全部模块
npm install --save jh --m:all
# 按需模块
npm install --save jh --m:less,sass,ts
```
