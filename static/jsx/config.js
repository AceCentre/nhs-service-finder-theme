import _ from "lodash";

_.templateSettings.escape = /\{%-([\s\S]+?)%\}/g;
_.templateSettings.evaluate = /\{%([\s\S]+?)%\}/g,
_.templateSettings.interpolate = /\{%=([\s\S]+?)%\}/g;
_.templateSettings.variable = "data";

export let get_postcode_url_prefix = "//api.postcodes.io/postcodes/";
export let ccgtopo_path = "/data/ccg.topojson";
export let ccgmap_all_path = "/ccgmap/all/rawdata.json";
export let ccgcode_taxonomy_data_path = "/ccgcodes/{}/rawdata.json";
export let ccgtemplate_path = "/ccgtemplate/{}";
export let ccglookup_template_path = "/embedtemplate/";

