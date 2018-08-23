'use strict';
const gulp = require('gulp');
const sass = require('gulp-sass');
const webpack = require('webpack');
const webpackst = require('webpack-stream');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const eslint = require('gulp-eslint');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const path = require('path');

let jsfiles = {};
if (!('NO_MAIN' in process.env))
  jsfiles.main = './static/jsx/main.js';
if (!('NO_EMBED' in process.env))
  jsfiles.ccglookup_embed = './static/jsx/ccglookup_embed.js';

function wpdefine_options(is_production) {
  return {
    'process.env.IS_PRODUCTION': JSON.stringify(is_production),
    'process.env.HOST_URL': JSON.stringify(process.env.HOST_URL||"")
  };
}

let webpackConfig = {
  entry: jsfiles,
  performance: { hints: false },
  resolve: {
    modules: [ 'node_modules' ],
    alias: {
      'jquery': path.resolve(__dirname, 'static/components/jquery/dist/jquery.js'),
      'foundation-sites': path.resolve(__dirname, 'static/components/foundation-sites/js/entries/foundation.js')
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime'],
          },
        },
      },
    ],
  },
};
 
gulp.task('script-lint', function () {
    return gulp.src(['static/jsx/**/*.js'])
        .pipe(eslint())
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
});

gulp.task('build-script-prod', function () {
  return gulp.src('.')
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      output: {
        filename: '[name].min.js',
      },
      mode: 'production',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin(wpdefine_options(true)),
        new UglifyJsPlugin({
          exclude: /min\.js$/,
          sourceMap: true,
        }),
      ],
    }), webpack))
    .pipe(gulp.dest('static/jsbundle/'));
});

gulp.task('build-script-dev', function () {
  return gulp.src('.')
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      output: {
        filename: '[name].js',
      },
      mode: 'development',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin(wpdefine_options(false)),
      ],
    }), webpack))
    .pipe(gulp.dest('static/jsbundle/'));
});

gulp.task('sass-dev', function () {
  return gulp.src('static/sass/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('static/css/'));
});

gulp.task('sass-prod', function () {
  return gulp.src('static/sass/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
    .pipe(rename(function (path) {
      path.extname = ".min.css";
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('static/css/'));
});

gulp.task('build-script-dev:watch', function () {
  return gulp.src('.')
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      watch: true,
      output: {
        filename: '[name].js',
      },
      mode: 'development',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin(wpdefine_options(false)),
      ],
    }), webpack))
    .pipe(gulp.dest('static/jsbundle/'));
});


gulp.task('sass-dev:watch', function () {
  gulp.watch('static/sass/**/*.scss', gulp.series('sass-dev'));
});

gulp.task('dev', gulp.series('sass-dev', gulp.parallel('sass-dev:watch', 'build-script-dev:watch')));

gulp.task('build-prod', gulp.series(/*'script-lint', */'build-script-prod', 'sass-prod'));
gulp.task('build-dev', gulp.series(/*'script-lint', */'build-script-dev', 'sass-dev'));

gulp.task('default', function (done) {
  console.log(`
   Available commands:
     - sass-dev
     - sass-dev:watch
     - sass-prod
     - script-lint
     - build-script-dev
     - build-script-prod
     - build-script-dev:watch
     - build-prod
     - dev  (live watch for changes on sass and modular javascript)
`);
  done();
});
