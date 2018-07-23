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

let webpackConfig = {
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
  return gulp.src(['static/jsx/main.js'])
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      output: {
        filename: '[name].min.js',
      },
      mode: 'production',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('production')
        }),
        new UglifyJsPlugin({
          exclude: /min\.js$/,
          sourceMap: true,
        }),
      ],
    }), webpack))
    .pipe(gulp.dest('static/jsbundle/'));
});

gulp.task('build-script-dev', function () {
  return gulp.src(['static/jsx/main.js'])
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      output: {
        filename: '[name].js',
      },
      mode: 'development',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('development')
        }),
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
  return gulp.src('static/sass/style.scss')
    .pipe(sourcemaps.init())
    .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
    .pipe(rename(function (path) {
      path.extname = ".min.css";
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('static/css/'));
});

gulp.task('build-script-dev:watch', function () {
  return gulp.src(['static/jsx/main.js'])
    .pipe(webpackst(Object.assign({}, webpackConfig, {
      watch: true,
      output: {
        filename: '[name].js',
      },
      mode: 'development',
      devtool: 'source-map',
      plugins: [
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify('development')
        }),
      ],
    }), webpack))
    .pipe(gulp.dest('static/jsbundle/'));
});


gulp.task('sass-dev:watch', function () {
  gulp.watch('static/sass/**/*.scss', gulp.series('sass-dev'));
});

gulp.task('dev', gulp.parallel('sass-dev:watch', 'build-script-dev:watch'));

gulp.task('build-prod', gulp.series('script-lint', 'build-script-prod', 'sass-prod'));
gulp.task('build-dev', gulp.series('script-lint', 'build-script-dev', 'sass-dev'));

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
