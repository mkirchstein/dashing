var gulp = require('gulp'),
    del = require('del'),
    less = require('gulp-less'),
    inject = require("gulp-inject"),
    runSequence = require('run-sequence'),
    rename = require("gulp-rename"),
    concat = require('gulp-concat'),
    html2js = require("gulp-ng-html2js"),
    ngmin = require("gulp-ng-annotate"),
    flatten = require('gulp-flatten'),
    template = require('gulp-template'),
    yargs = require('yargs'),
    _ = require('lodash'),
    uglify = require('gulp-uglify'),
    pkg = require('./package.json'),
    jshint = require('gulp-jshint'),
    browserSync = require('browser-sync').create(),
    path = require('path'),
    Server = require('karma').Server,
    merge = require('merge-stream'),
    angularFilesort = require('gulp-angular-filesort'),
    jsonServer = require('gulp-json-srv'),
    notify = require('gulp-notify')
    map = require('map-stream');
    path = require('path');
    events = require('events');
    emitter = new events.EventEmitter();

var files = require('./gulp/gulp.config.js');

/*
 The primary build task. We use runSequence to prevent any race-conditions.
 These conditions can occur because Gulp runs in parallel.

 We pass in a callback so that runSequence can notify gulp that the sequence is complete.
 */
gulp.task('build', function (callback) {
    runSequence('clean',
        'copy-build',
        'html2js',
        'less',
        'index',
        callback);
});

/*
 The defualt task that runs when we type "gulp"
 */
gulp.task('default', function (callback) {
    runSequence('build',
        'watch',
        'server',
        'serve',
        callback);
});

/*
 Selectively build JUST the JS source.
 */
gulp.task('build-src', function (callback) {
    runSequence('copy-build', 'index', callback)
});

/*
 Use 'del', a standard npm lib, to completely delete the build dir
 */
gulp.task('clean', function (callback) {
    return del(['./build'], {force: true}, callback);
});

/*
 Use 'del', a standard npm lib, to completely delete the bin (production) dir
 */
gulp.task('clean-bin', function (callback) {
    return del(['./bin'], {force: true}, callback);
});


gulp.task('copy-build', ['copy-vendor-assets', 'copy-assets', 'copy-app-js', 'copy-vendor-js']);

gulp.task('copy-assets', function () {
    return gulp.src('./src/assets/**/*')
        .pipe(gulp.dest('./build/assets'));
});

gulp.task('copy-vendor-assets', function () {
    return gulp.src(files.vendor_files.css, {cwd: 'node_modules'})
        .pipe(gulp.dest('./build/vendor'));
});

gulp.task('copy-app-js', function () {
    return gulp.src(files.app_files.js)
        .pipe(gulp.dest('./build'));
});

gulp.task('copy-vendor-js', function () {
  return gulp.src(files.vendor_files.js, {cwd: 'node_modules'})
    .pipe(gulp.dest('./build/vendor'));
});

gulp.task('copy-compile', ['copy-compile-assets']);

gulp.task('copy-compile-assets', function () {
    return gulp.src(files.app_files.assets_compile)
        .pipe(gulp.dest('./bin/assets'));
});

gulp.task('html2js', function () {
    return gulp.src(files.app_files.atpl)
        .pipe(html2js({
            moduleName: "templates-app"
        }))
        .pipe(concat('templates-app.js'))
        .pipe(gulp.dest("./build/app"));
});

gulp.task('less', function () {
    return gulp.src(files.app_files.styles)
        .pipe(less({
            compile: true,
            compress: false,
            noUnderscores: false,
            noIDs: false,
            zeroUnits: false
        }))
        .pipe(flatten())
        .pipe(gulp.dest('./build/assets/css/'));
});

gulp.task('less-compile', function () {
  return gulp.src(['./build/**/*.css'])
    .pipe(concat(pkg.name + '-' + pkg.version + '.css'))
    .pipe(gulp.dest('./bin/assets/css/'));
});

/*
 Used to populate the index.html template with JS sources
 from the "build" dir.
 */
gulp.task('index', function () {

    return gulp.src('./src/index.html')
        .pipe(inject(
            gulp.src(files.app_files.tpl_src), {
                ignorePath: 'build'
            }))
        .pipe(gulp.dest("./build"))
        .pipe(browserSync.stream());
});

/*
 Used to populate the index.html template with JS sources
 from the "bin" folder during compile task.
 */
gulp.task('index-compile', function () {
    return gulp.src('./src/index.html')
        .pipe(inject(gulp.src(['./bin/**/*.js', './bin/**/*.css'], {read: false}), {
            ignorePath: files.compile_dir + '/'
        }))
        .pipe(gulp.dest("./" + files.compile_dir));
});

gulp.task('ngmin', function () {
    return gulp.src(files.app_files.ngmin_js)
        .pipe(ngmin())
        .pipe(gulp.dest(files.compile_dir));
});

gulp.task('uglify', function () {
    return gulp.src(files.app_files.ngmin_js)
        .pipe(uglify());
});

gulp.task('concat', function () {

    return gulp.src(files.app_files.js_compile)
        .pipe(concat(pkg.name + '-' + pkg.version + '.min.js'))
        .pipe(gulp.dest('./bin/assets'))
});

gulp.task('serve', function () {
  browserSync.init({
      server: {
          baseDir: "./build"
      }
  });
});

gulp.task('compile', function (callback) {
    runSequence('build',
        'clean-bin',
        'copy-compile',
        'concat',
        'ngmin',
        'uglify',
        'less-compile',
        'index-compile',
        callback);
});

gulp.task('server', function () {
    jsonServer.start({
        data: 'server/db.json',
        port: 3000
    });
});

gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js'
  }, done).start();
});

gulp.task('lint', function() {
    return gulp.src(files.app_files.js)
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(jsHintErrorReporter()) /* Emits error for notify to pick up below */
        .on('error', handleErrors);
});

gulp.task('watch', function () {
    gulp.watch(files.app_files.js, ['lint', 'build-src']);
    gulp.watch(files.app_files.atpl, ['html2js', 'index']);
    gulp.watch(files.app_files.html, ['index']);
    gulp.watch(files.app_files.styles, ['less', 'index']);

    gulp.watch('./src/config/**/*.json', ['config-build']);
});

gulp.task('component', function () {
  const cap = function (val) {
    return val.charAt(0).toUpperCase() + val.slice(1);
  };
  const name = yargs.argv.name;
  const parentPath = yargs.argv.parent || '';
  const destPath = path.join('./src/app', parentPath, name);

  return gulp.src(files.blank_templates)
    .pipe(template({
      name: name,
      upCaseName: cap(name),
      templatePath: destPath.replace('src/app/', '')
    }))
    .pipe(rename(function (path) {
      path.basename = path.basename.replace('temp', name);
    }))
    .pipe(gulp.dest(destPath));
});

/**
 *  Growl style notifications using gulp-notify
 **/
var handleErrors = function () {
  var args = Array.prototype.slice.call(arguments);

  // Send error to notification center with gulp-notify
  notify.onError({
    title: "Compile Error",
    message: "<%= error %>"
  }).apply(this, args);

  // Keep gulp from hanging on this task
  this.emit('end');
};
var jsHintErrorReporter = function ( file, callback ) {
  return map(function ( file, callback ) {
    if (!file.jshint.success) {
      file.jshint.results.forEach(function ( error ) {
        if (error) {
          var msg = [
            path.basename(file.path),
            'Line: ' + error.error.line,
            'Reason: ' + error.error.reason
          ];

          emitter.emit('error', new Error(msg.join('\n')));
        }
      });
    }

    callback(null, file);
  });
};
