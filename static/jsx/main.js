import "./compat.js";
import $ from "jquery";
import Foundation from 'foundation-sites';
import "./ccglookup.js";
import _ from "lodash";

_.templateSettings.escape = /\{%-([\s\S]+?)%\}/g;
_.templateSettings.evaluate = /\{%([\s\S]+?)%\}/g,
_.templateSettings.interpolate = /\{%=([\s\S]+?)%\}/g;
_.templateSettings.variable = "data";
