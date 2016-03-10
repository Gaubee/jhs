# 文件读取原理

文本类型的文件需要编译

所以需要完全读取到内存里面后进行编译

非文本类型不需要编译，在判断不是文本后，直接返回

考虑到视频流等大文件，文件不该直接缓存到内存中，即便是文本类型，也不利于输出。

所以对外接口，统一使用Stream。

jhs文件服务器需要的接口有以下：

1. 判断文件是否在文件夹树中（404 or 200）fss.existsFileInPathsMutilAsync(paths, file)
2. 获取 文件 流（用于输出）cache.getFileCache(files).source_stream
3. 流 转 字符串（用于编译）fss.getStreamContent(source_stream)
4. 字符串 转 流标识（用于缓存文件）temp.set(type, md5, source_stream)
4. 流标识 转 流（用于缓存文件）temp.get(type, md5)
5. 获取文件MD5 cache.getFileCache(files).source_md5

## 优化

* source_md5 改成按需获取，因为只有文本类型的文件需要用这个md5去获取编译出来的文件
* 废弃 cache.getFileCache(files).source_content ，使用 cache.getFileCache(files).source_stream 配合 fss.getStreamContent(source_stream) 来替代
