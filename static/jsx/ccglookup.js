import _ from "lodash";
import {auto_ccgmap1} from "./ccgmap";
import {$get,$new,http_get} from "./util";
import strformat from "string-format";

export let ccgmap_cache = {};
export let ccgmap_ccg_list;

var isBrowser = typeof window != 'undefined';
var isIE = isBrowser && /MSIE |Trident\//.test(navigator.userAgent);
/*
var isIE11 = isBrowser$1 && !!(window.MSInputMethodContext && document.documentMode);
var isIE10 = isBrowser$1 && /MSIE 10/.test(navigator.userAgent);
*/

export async function ccg_lookup_auto (extra) {
  let ccglookup_elm = $get("ccglookup");
  let ccglookup_elm_data = {};
  for (let att of ccglookup_elm.attributes) {
    if (att.name.indexOf("data-") == 0) {
      let name = att.name.substr("data-".length);
      if (name) {
        ccglookup_elm_data[name] = att.value;
      }
    }
  }
  if (!ccglookup_elm) {
    console.info("ccglookup terminate, Could not find #ccglookup")
    return false;
  }
  if (isIE) {
    ccglookup_elm.classList.add('--ua-ie');
  } else {
    ccglookup_elm.classList.add('--ua-nonie');
  }
  if (ccglookup_elm.hasAttribute("data-inject")) {
    let ccglookup_template_elm = $get("ccglookup-template");
    if (!ccglookup_template_elm) {
      if (!extra.ccglookup_template_url)
        throw new Error("Could not look for ccglookup template, Maybe I'm not loaded with ccglookup_embed.js");
      let templates_div = $new("div");
      templates_div.innerHTML = await http_get(extra.ccglookup_template_url);
      ccglookup_elm.appendChild(templates_div);
      ccglookup_template_elm = $get("ccglookup-template");
      if (!ccglookup_template_elm) {
        throw new Error("ccglookup template has no #ccglookup-template");
      }
      // wrapping the template content in another inner div will save templates_div 
      let inner_elm = $new("div");
      inner_elm.classList.add("ccglookup-inner");
      inner_elm.innerHTML = _.template(ccglookup_template_elm.innerHTML)(ccglookup_elm_data);
      ccglookup_elm.appendChild(inner_elm);
      // load item template if any exists
      if (extra.item_templates) {
        for (let telm of templates_div.getElementsByClassName("ccglookup-item-template")) {
          let tplname = telm.getAttribute("data-name");
          if (tplname) {
            extra.item_templates[tplname] = _.template(telm.innerHTML);
          }
        }
      }
    }
  }
  let lookup_form = $get("ccg-lookup-form")
  if (lookup_form) {
    lookup_form.addEventListener("submit", lookup_form_submit_bind(extra), false);
  }
  return true;
}

export function lookup_form_submit_bind(extra) {
  return (evt) => {
    evt.preventDefault()
    new Promise((resolve, reject) => {
      let service_input = $get("ccg-service-input")
      let postcode_input = $get("ccg-postcode-input")
      if(!service_input || !postcode_input)
        throw new Error("Could not find service or postcode inputs for ccg");
      let service = service_input.value || "ALL";
      if(!postcode_input.value) {
        throw new Error("Please write a postcode")
      }
      if(!postcode_input.value.match(/^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i) && postcode_input.value[0] != "#") { // hashtag is special case for debugging
        throw new Error("Input postcode do not match uk postcode standard")
      }
      ccg_lookup(service, postcode_input.value, extra)
        .then(resolve, reject)
    })
      .catch((err) => {
        console.error(err);
        alert(err.message || err+"")
      });
  };
}

let ccg_lookup_clear = function() { }

export async function ccg_lookup(service, postcode, extra) {
  let {get_postcode_url_prefix, ccgtopo_url, ccgmap_all_url,
       ccgcode_taxonomy_data_url, ccgtemplate_url} = extra;
  ccg_lookup_clear();
  if (!ccgmap_ccg_list && ccgmap_all_url) {
    try {
      let res = JSON.parse(await http_get(ccgmap_all_url));
      ccgmap_ccg_list = res.items ? res.items : [];
    } catch (err) {
      console.error(err);
      throw new Error("Could not load: " + ccgmap_all_url);
    }
  }
  let is_direct_lookup = postcode[0] == "#"
  let ccgcode, data, result_el, postcode_res;
  if (is_direct_lookup) {
    ccgcode = postcode.substr(1);
  } else {
    try {
      postcode_res = JSON.parse(await http_get(get_postcode_url_prefix + postcode));
      if (postcode_res.result) {
        postcode_res = postcode_res.result;
        ccgcode = postcode_res.codes.ccg;
      } else {
        throw new Error("Unexpected response from postcodes.io, " + JSON.stringify(postcode_res))
      }
      if (!ccgcode) {
        throw new Error("Unexpected, ccgcode does not exists!");
      }
    } catch (err) {
      console.error(err);
      throw new Error("Could not lookup for ccg-code for the input postal code");
    }
  }
  ccgcode = ccgcode.toLowerCase();
  // load the list of postcodes
  try {
    result_el = $get("ccg-lookup-result");
    data = JSON.parse(await http_get(strformat(ccgcode_taxonomy_data_url, ccgcode)));
    if (!data.items || data.items.length == 0) {
      result_el.innerHTML = "No result found for ccgcode, " + ccgcode;
      return;
    }
  } catch (err) {
    console.error(err);
    throw new Error("ccg code not found, " + ccgcode);
  }
  if (service != 'ALL') {
    for (let i = 0; i < data.items.length; ) {
      let item = data.items[i];
      if ((item.ccgservices||[]).indexOf(service.toLowerCase()) == -1) {
        data.items.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  let tpls = extra.item_templates||{};
  let promises = [];
  // fetch templates
  for (let item of data.items) {
    let tplname = item.template || "default.tpl";
    if (!tpls[tplname]) {
      if (tplname.indexOf("/") != -1) {
        throw new Error("template name should not contain slash, " + tplname);
      }
      tpls[tplname] = true;
      promises.push(
        http_get(strformat(ccgtemplate_url, tplname))
          .then((res) => {
            return tpls[tplname] = _.template(res);
          })
      );
    }
  }
  await Promise.all(promises);
  result_el.innerHTML = "";
  // print results
  for (let item of data.items) {
    let tplname = item.template || "default.tpl";
    let tpl = tpls[tplname];
    let ielm = $new("div");
    ielm.classList.add("ccg-item");
    ielm.innerHTML = tpl(item);
    result_el.appendChild(ielm);
  }
  let ccgmap_inf;
  if (ccgtopo_url) {
    let map_extra = {
      ccg_list: ccgmap_ccg_list || data.items,
      cache: ccgmap_cache, zoom: 3,
      ccg_lookup, input_service: service, input_postcode: postcode,
      highlight_ccgcode: ccgcode, 
    };
    if (postcode_res) {
      map_extra.highlight_points = [ {
        pos: [ postcode_res.longitude, postcode_res.latitude ]
      } ];
    }
    ccgmap_inf = await auto_ccgmap1(ccgtopo_url, map_extra);
  }
  ccg_lookup_clear = function () {
    if (ccgmap_inf)
      ccgmap_inf.destroy();
  };
}

