var gulp = require('gulp');
var less = require('gulp-less');//less解析
var path = require('path');
var babel = require('gulp-babel');
var glob=require('glob');//获取哪些文件有require语法
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify=require('browserify');//解析require文件
var babelify = require('babelify');//解析require文件 模块
var browserSync = require('browser-sync');//服务器文件
var changed = require('gulp-changed');//找出改变的文件
var rev = require('gulp-rev');//对文件添加哈希值
var clean= require('gulp-clean');//清除文件
var runSequence = require('run-sequence');//按顺序执行
var revCollector = require('gulp-rev-collector');//对html文件进行文件更名
var fs=require('fs')//node 自带io模块
const autoprefixer = require('gulp-autoprefixer');//css添加前缀
var through = require('through2');
let cleanCSS = require('gulp-clean-css');//压缩css
const imagemin = require('gulp-imagemin');//图片压缩
var concat = require('concat-stream');
var stream = require('stream');
var replace=require('gulp-replace');//替换文字
var uglify = require('gulp-uglify');//js 压缩
var zip = require('gulp-zip'); //打包成zip
var fileinclude = require('gulp-file-include');//可复用html
var revManifestJs={};//rev-manifest 配置文件
var outNum=0;//输出次数
var buildStartTime=new Date().getTime();//开始时间
var bs;
var alikeTask={
    added:{
        //如果发生增加文件
        fn:['serve']
    },
    deleted:{
        //如果发生删除文件
        fn:['serve']
    }
}
var picture={}
var pictureType=['.png','.jpg','.jpeg','.gif','.svg'];
pictureType.forEach((item,index)=>{
    picture[item]={
        changed:{
            //如果文件发生变化
            fn:['imgCopy']
        },
       ...alikeTask
    }
});
var fileWatch={
    '.html':{
        changed:{
            //如果文件发生变化
            fn:['html']
        },
       ...alikeTask
    },
    '.less':{
        changed:{
            //如果文件发生变化
            fn:['less']
        },
        ...alikeTask
    },
    '.js':{
        changed:{
            //如果文件发生变化
            fn:['browserify']
        },
        ...alikeTask
    },
    ...picture
}
gulp.task('serve',['clear'], function() {
    //启动服务器
    runSequence(['browserify','imgCopy','less'],['server'])
});

gulp.watch(['src/**/*'],((e)=>{
    //监听文件发生变化 增加、减少或者变化
    // if(fileWatch[path.parse(e.path).ext]&&fileWatch[path.parse(e.path).ext][e.type]&&fileWatch[path.parse(e.path).ext][e.type].fn){
        runSequence(...fileWatch[path.parse(e.path).ext][e.type].fn);
    // }
    
}))
gulp.task('server',['html'],()=>{
    //新建服务器并监听文件
    if(bs){
        bs.exit();
    }
    bs=browserSync.create();
    bs.init({
        open: false,
        server: {
            baseDir: "dev"
        }
    },()=>{
        
    });
    
})

gulp.task('html',function (cb) {
    //移动html到dev文件夹 在es6 运行之后执行html
        return gulp.src(['./rev/**/*.json','./src/pages/*.html'])

        .pipe(revCollector({
            replaceReved:true,
            dirReplacements:{
                '../css':'./css',
                '../js':'./js',
                '../img':'./img',
            }
        }))
        .pipe(replace(/\<\/body\>/g,'</body>\n<script src="./js/public.js"></script>'))
        .pipe(fileinclude({
            prefix: '@@',//变量前缀 @@include
            basepath: './src/components',//引用文件路径
            indent:true//保留文件的缩进
        }))
        .pipe(gulp.dest('./dev'))
        .on('end',()=>{
            if(bs&&bs.reload){
                bs.reload();    
            }
        })
        cb()
        
    
});
gulp.task('img',['clearImg'],function () {
    //图片压缩
    return gulp.src('./src/img/*')
      .pipe(rev())
	  .pipe(imagemin())
      .pipe(gulp.dest('./dev/img'))
      .pipe(rev.manifest())
      .pipe(gulp.dest('./rev/img'))
      .on('end',()=>{
        runSequence(['html'])
        // 
      })
});
gulp.task('imgCopy',['clearImg'],function () {
    //图片复制
    return gulp.src('./src/img/*')
      .pipe(rev())
      .pipe(gulp.dest('./dev/img'))
      .pipe(rev.manifest())
      .pipe(gulp.dest('./rev/img'))
      .on('end',()=>{
        runSequence(['html'])
        // 
      })
});
gulp.task('less',['clearCss'],function () {
    //解析less
    return gulp.src('./src/less/*.less')
      .pipe(less({
        paths: [path.join(__dirname,'./src/less','includes')]
      }))
      .pipe(rev())
      .pipe(cleanCSS({compatibility: 'ie8'}))
      .pipe(autoprefixer({
        browsers: ['last 2 versions'],
        cascade: false
       }))
      .pipe(gulp.dest('./dev/css'))
      .pipe(rev.manifest())
      .pipe(gulp.dest('./rev/css'))
      .on('end',()=>{
        runSequence(['html'])
        // 
      })
});

gulp.task("browserify",['clearJS'],(cb)=>{
    var factorBundleFileFN=[]
    revManifestJs={}
    outNum=0;
    glob('./src/js/*.js',function(err, files) {
        var num=0;
        files.forEach((item,index)=>{
            factorBundleFileFN.push(factorBundleFile(path.basename(item),files.length))
        })
        var b = browserify(files);
        b.plugin('factor-bundle', { outputs:factorBundleFileFN });
        b.bundle()
        .pipe(source('public.js'))
        .pipe(buffer())
        .pipe(gulp.dest('./dev/js'))
        cb();
    })
    
})

function factorBundleFile(name,len){
    //处理输出的文件 重命名
    return concat(function (body) {
        var bufferStream = new stream.PassThrough();
        bufferStream.end(body);
        bufferStream
        .pipe(source(name))
        .pipe(buffer())
        .pipe(rev())
        .pipe(babel({
            // presets: ['es2015']
            // presets: ['@babel/env']
            plugins: ['@babel/transform-runtime']
        }))
        .pipe(gulp.dest('./dev/js'))
        .pipe(rev.manifest({merge: true}))
        .pipe(function(){
            return through.obj(function (file, enc, cb) {
                revManifestJs={...revManifestJs,...JSON.parse(file._contents.toString())}
                this.push(file); // 似乎需要push一下，不然后续的pipe不会处理这个文件？
                return cb();
            });
        }())
        .pipe(gulp.dest('./rev/js'))
        .on('end',()=>{
            outNum+=1;
            if(outNum==len){
                // console.log('全部写入完成')
                var jsonPath=path.resolve(__dirname,'./rev/js/rev-manifest.json');
                fs.writeFile(jsonPath,JSON.stringify(revManifestJs),function(){
                    runSequence(['html'])
                })
            }
        })
    });
}

gulp.task("build",()=>{
    //打包
    runSequence(['browserify','img','less'],['contractionJS'])
})

gulp.task("contractionJS",()=>{
    //压缩js
    gulp.src('./dev/js/*.js')
    .pipe(uglify({
        ie8:true
    }))
    .on('error', function (err) {
        console.log(err)
    })
    .pipe(gulp.dest('./dev/js'))
    .on('end',()=>{
        runSequence(['zip'])
    })
})

gulp.task("zip",()=>{
    gulp.src('./dev/**/*')
    .pipe(zip('build.zip'))
    .pipe(gulp.dest('./dev'))
    .on('end',()=>{
        console.log('打包时间'+((new Date().getTime()-buildStartTime)/1000))
        process.exit();
    })
})



gulp.task("clear",()=>{
    //清除dev中的所有文件
    return gulp.src(['./dev']).pipe(clean());
})
gulp.task("clearJS",()=>{
    //清除dev/js中的文件
    return gulp.src(['./dev/js']).pipe(clean());
})
gulp.task("clearCss",()=>{
    //清除css
    return gulp.src(['./dev/css']).pipe(clean());
})
gulp.task("clearImg",()=>{
    //清除图片
    return gulp.src(['./dev/img']).pipe(clean());
})

