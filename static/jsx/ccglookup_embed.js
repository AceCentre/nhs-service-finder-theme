import "./compat";
import {ccg_lookup, ccg_lookup_auto} from "./ccglookup";
import {get_postcode_url_prefix, ccgtopo_path, ccgmap_all_path,
        ccgcode_taxonomy_data_path, ccgtemplate_path,
        ccglookup_template_path} from "./config";

let host_url = process.env.HOST_URL;
let ccglookup_extra = {
  get_postcode_url_prefix, ccgtopo_url: host_url + ccgtopo_path,
  ccgmap_all_url: host_url + ccgmap_all_path,
  ccgtemplate_url: host_url + ccgtemplate_path,
  ccgcode_taxonomy_data_url: host_url + ccgcode_taxonomy_data_path,
  ccglookup_template_url: host_url + ccglookup_template_path,
  item_templates: {}
};

async function ondomready() {
  if (await ccg_lookup_auto(ccglookup_extra)) {
    if (!process.env.IS_PRODUCTION) {
      // autotest
      ccg_lookup("ALL", "#e38000211", ccglookup_extra);
    }
  }
}
document.addEventListener("DOMContentLoaded", ondomready, false);
