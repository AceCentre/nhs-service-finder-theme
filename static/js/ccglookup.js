import _ from "lodash";

let service_options = [ "ALL", "AAC", "EC", "WCS" ]
let get_postcode_url_prefix = '//api.postcodes.io/postcodes/'
let $get = (a) => document.getElementById(a)
let $new = (a) => document.createElement(a)

function ondomready() {
  let lookup_form = $get("ccg-lookup-form")
  if(!lookup_form) {
    console.info("ccg-lookup terminate, Could not find #ccg-lookup-form")
    return;
  }
  lookup_form.addEventListener("submit", lookup_form_submit, false);
  let service_input = $get("ccg-service-input")
  if(!service_input)
    throw new Error("Could not find service or postcode inputs for ccg");
  _.each(service_options, (service) => {
    let opt = $new("option")
    opt.value = service
    opt.innerHTML = service
    service_input.appendChild(opt)
  });
}
document.addEventListener("DOMContentLoaded", ondomready, false);

function lookup_form_submit(evt) {
  evt.preventDefault()
  new Promise((resolve, reject) => {
    let service_input = $get("ccg-service-input")
    let postcode_input = $get("ccg-postcode-input")
    if(!service_input || !postcode_input)
      throw new Error("Could not find service or postcode inputs for ccg");
    let service = _.find(service_options, (a) => a == service_input.value)
    if(!service)
      throw new Error("Could not find service of name: "+ service_input.value);
    if(!postcode_input.value) {
      throw new Error("Please write a postcode")
    }
    if(!postcode_input.value.match(/^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i) && postcode_input.value[0] != "#") { // hashtag is special case for debugging
      throw new Error("Input postcode do not match uk postcode standard")
    }
    
    ccg_lookup(service, postcode_input.value)
      .then(resolve, reject)
  })
    .catch((err) => {
      alert(err)
    });
}

async function ccg_lookup(service, postcode) {
  let is_direct_lookup = postcode[0] == "#"
  let ccgcode;
  if (is_direct_lookup) {
    ccgcode = postcode.substr(1);
  } else {
    try {
      let res_json = JSON.parse(await http_get(get_postcode_url_prefix + postcode));
      ccgcode = res_json.codes.ccg;
      if (!ccgcode) {
        throw new Error("Unexpected, ccgcode does not exists!");
      } else {
        throw new Error("Unexpected response from postcodes.io, " + JSON.stringify(response))
      }
    } catch (err) {
      console.error(err);
      throw new Error("Could not lookup for ccg-code for the input postal code");
    }
  }
  // load the list of postcodes
  try {
    let result_el = $get("ccg-lookup-result");
    let data = JSON.parse(await http_get("/ccgcodes/" + ccgcode.toLowerCase() + "/rawdata.json"));
    if (!data.items || data.items.length == 0) {
      result_el.innerHTML = "No result found for ccgcode, " + ccgcode;
    }
    if (service != 'ALL') {
      for (let i = 0; i < data.items.length; ) {
        let item = data.items[i];
        if (item.ccgservices.indexOf(service.toLowerCase()) == -1) {
          data.items.splice(i, 1);
        } else {
          i++;
        }
      }
    }
    let tpls = {};
    let promises = [];
    // fetch templates
    for (let item of data.items) {
      let tplname = item.template || "default.tpl";
      if (!tpls[tplname]) {
        if (tplname.indexOf("/") != -1) {
          throw new Error("template name should not contain slash, " + tplname);
        }
        tpls[tplname] = { name: tplname };
        promises.push(
          http_get("/ccgtemplate/" + tplname)
            .then((res) => {
              return tpls[tplname].template = _.template(res, {variable:"data"});
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
      ielm.innerHTML = tpl.template(item);
      result_el.appendChild(ielm);
    }
  } catch (err) {
    console.error(err);
    throw new Error("ccg code not found, " + ccgcode);
  }
}

function http_get(url) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest()
    xhr.open("GET", url)
    xhr.onreadystatechange = function () {
      if(xhr.readyState === 4) {
        if(xhr.status === 200) {
          resolve(xhr.responseText)
        } else {
          let err = new Error(xhr.status + " " + xhr.statusText);
          err.xhr = xhr
          reject(err)
        }
      }
    };
    xhr.send()
  });
}

