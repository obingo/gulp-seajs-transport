var gutil = require("gulp-util");
var PluginError = gutil.PluginError;
var through = require("through2");
var path = require("path");
var util = require("util");

module.exports = function (options) {

    options = options || {};

    var stream = through.obj(function (file, enc, cb) {

        var seajsModule = {};

        var base = null;

        if (!file) {

            this.emit("error", new PluginError("gulp-seajs-transport", "files can not be empty"));

            return cb();

        }

        if (file.isStream()) {

            this.emit("error", new PluginError("gulp-seajs-transport", "streaming not supported"));

            return cb();

        }


        if (file.isBuffer()) {

            if (options.base) {

                base = path.join(file.cwd, options.base);

            }

            else {

                base = file.base;

            }

            var contents = file.contents.toString();

            seajsModule.dependencies = parseDependencies(contents);

            seajsModule.id = parseId(file.path, base);

            seajsModule.contents = parseContents(contents);

            var transportModule = parseTransportTemplate(seajsModule);

            file.contents = new Buffer(transportModule);

            this.push(file);
        }
        
        cb();
    })

    return stream;

    /*
     复制seajs的util-deps.js代码，获取依赖
     */
    function parseDependencies(code) {

        var REQUIRE_RE = /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r\n])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;

        var SLASH_RE = /\\\\/g;

        var ret = [];

        code.replace(SLASH_RE, "")
            .replace(REQUIRE_RE, function (m, m1, m2) {

                if (m2) {

                    ret.push(m2)

                }

            })

        return ret
    }


    /*
     匹配seajs模块的内容文本
     */
    function parseContents(code) {

        var CONTENTS_RE = /define\s*\(\s*function\s*\(.*?\)\s*\{([\S\s]+)\}\s*\)/g;

        var ret = "";

        code.replace(CONTENTS_RE, function (m, m1) {

            if (m1) {

                ret = m1;

            }

        })

        return ret;
    }

    /*
     得到模块ID,相对于某个base路径的
     filepath:/root/ab/c/d.js
     transportBase:/root/ab

     =>c/d
     */
    function parseId(filepath, transportBase) {

        var id = filepath
            .replace(transportBase, "")//得到相对于base的路径
            .replace(/\\/g, "/")//将windows下的反斜线转成斜线
            .replace(/^\/|\.\w+$/g, "");//去掉路径最前面的斜杠和和后缀

        return id;
    }

    /*
     生成transport化后的模块
     */
    function parseTransportTemplate(seajsModule) {

        var tpl = 'define("%s",%j,function(require,exports,module){%s})';

        return util.format(tpl, seajsModule.id, seajsModule.dependencies, seajsModule.contents);

    }
}
