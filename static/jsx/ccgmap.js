import * as topojson from "topojson-client";
import * as d3 from "./d3custom";
import tippy from "tippy.js";
import {$get,$new} from "./util";
import _ from "lodash";

let tippy_default_options = {
  hideOnClick: false,
  interactive: true,
  delay: [ 1000, 500 ],
};

function get_tippy_delay (tippy_inf, action) {
  return typeof tippy_inf.options.delay == 'number' ?
    tippy_inf.options.delay :
    (tippy_inf.options.delay.length == 2 ?
     tippy_inf.options.delay[action == 'show' ? 0 : 1] : 0);
}

export async function auto_ccgmap1 (ccgtopo_url, extra) {
  let mapsvg = $get("ccg-map-svg");
  let mapsvg_wrapper = $get("ccg-map-wrapper");
  mapsvg_wrapper.style.display = "block";
  let map_ratio = (mapsvg.getAttribute("data-ratio") || "1:1").split(":")
      .reduce((a, b) => +a / +b);
  if (isNaN(map_ratio)) {
    map_ratio = 1;
  }
  mapsvg_set_size();
  let ccgmapi = await init_ccgmap();
  window.addEventListener("resize", onresize, false);
  return {
    ccgmapi,
    destroy: () => {
      window.removeEventListener("resize", onresize, false);
      ccgmapi.destroy();
    }
  };
  function init_ccgmap () {
    return ccgmap(mapsvg, ccgtopo_url, extra);
  }
  function onresize () {
    set_sizes_needs_update();
  }
  let _set_sizes_needs_update_timeout = null;
  function set_sizes_needs_update () {
    if (_set_sizes_needs_update_timeout != null)
      clearTimeout(_set_sizes_needs_update_timeout);
    _set_sizes_needs_update_timeout = setTimeout(() => {
      _set_sizes_needs_update_timeout = null;
      update_sizes();
    }, 500);
  }
  let update_sizes_promise = null;
  function update_sizes() {
    return update_sizes_promise =
      (update_sizes_promise ? update_sizes_promise : Promise.resolve())
      .then(async () => {
        ccgmapi.destroy();
        mapsvg_set_size();
        ccgmapi = await init_ccgmap();
        update_sizes_promise = null;
      });
  }
  function mapsvg_set_size () {
    let w = mapsvg.parentNode.offsetWidth || 320, h = w / map_ratio
    mapsvg.setAttribute("width", w);
    mapsvg.setAttribute("height", h);
    mapsvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
}

export default async function ccgmap (svg_elm, topojson_url, extra) {
  extra = extra || {};
  let cache = extra.cache||{};
  let topology = cache.topology ? cache.topology : await d3.json(topojson_url);
  cache.topology = topology;
  let ccgcodes_override = extra.ccgcodes_overrides||{};
  let {width, height} = svg_elm.getBoundingClientRect();
  let ccg_list = extra.ccg_list || [];
  let tiptemplate = _.template($get("ccg-map-region-tooltip").innerHTML);
  let curzoom = extra.zoom || 1, minzoom = 1,
      zooms = [ 1, 2, 3, 6 ];
  let svg = d3.select(svg_elm);
  let geojson = topojson.feature(topology, topology.objects.ccg);
  let projection = d3.geoAlbers()
      .rotate([0.0, -15, 0.0]);
  let path = d3.geoPath()
      .projection(projection);
  // internal variables
  let _set_view_state_timeout, _set_view_state_resolves = [];
  project_at(path, geojson, width, height);
  let opened_inf, hover_inf_list = [];
  window.hover_inf_list = hover_inf_list;
  let map_layer = svg.append('g')
      .attr("class", "map-layer");
  geojson.features.forEach((obj) => init_obj_extra(obj));
  let ccg_highlighted_objs = geojson.features.filter((a)=>extra.highlight_ccgcode&&extra.highlight_ccgcode == a.ccgcode)
  map_layer.selectAll(".ccgregion")
    .data(geojson.features)
    .enter().append("path")
    .attr("class", "ccg-region")
    .each(function (obj) {
      if (extra.highlight_ccgcode && extra.highlight_ccgcode == obj.ccgcode) {
        this.classList.add("ccg-highlight");
        // bring to front
        this.parentNode.appendChild(this);
      }
    })
    .style("fill", (obj) => {
        let ccg_list = obj.ccg_list.filter((a) => !!a.servicecolor);
        return ccg_list.length > 0 ? ccg_list[0].servicecolor :
               (ccgcodes_override[obj.ccgcode] ?
                ccgcodes_override[obj.ccgcode].color : null);
    })
    .attr("d", path)
    .on("mouseover", function (obj) {
      if (!opened_inf) {
        hover_inf_list.forEach((hover_inf) => {
          if (hover_inf.obj == obj && hover_inf.hide_timeout == null) {
            hover_inf.tippy_inf.tooltips.forEach((a) => {
              if (a.state.visible) {
                a.hide();
              }
            });
          }
        });
        let hover_inf = hover_inf_list.find((a) => a.obj == obj);
        if (hover_inf) {
          if (hover_inf.hide_timeout != null) {
            clearTimeout(hover_inf.hide_timeout);
            hover_inf.hide_timeout = null;
          }
          hover_inf.tippy_inf.tooltips.forEach((a) => a.show());
          return;
        }
        hover_inf = {
          tippy_inf: make_obj_tippy(this, obj),
          obj,
        };
        hover_inf_list.push(hover_inf);
        hover_inf.show_timeout = setTimeout(() => {
          hover_inf.tippy_inf.tooltips.forEach((a) => a.show());
          hover_inf.show_timeout = null;
        }, get_tippy_delay(hover_inf.tippy_inf, "show"));
      }
    })
    .on("mouseout", function (obj) {
      let hover_inf = hover_inf_list.find((a) => a.obj == obj);
      if (hover_inf) {
        if (hover_inf.show_timeout != null) {
          clearTimeout(hover_inf.show_timeout);
          hover_inf.show_timeout = null;
          // on hidden will never get called, destroy now
          hover_inf.tippy_inf.destroyAll();
          hover_inf_list.splice(hover_inf_list.indexOf(hover_inf), 1);
        }
        if (hover_inf.hide_timeout == null) {
          hover_inf.hide_timeout = setTimeout(() => {
            hover_inf.tippy_inf.tooltips.forEach((a) => a.hide());
            hover_inf.hide_timeout = null;
          }, get_tippy_delay(hover_inf.tippy_inf, "hide"));
        }
      }
    })
    .on("click", function (obj) {
      if (opened_inf) {
        d3.select(opened_inf.elm)
          .classed("highlight", false);
        opened_inf.tippy_inf.tooltips.forEach((a) => a.hide());
      }
      if (!opened_inf || opened_inf.obj != obj) {
        d3.select(this).classed("highlight", true);
        let tippy_inf;
        for (let i = 0; i < hover_inf_list.length; ) {
          let hover_inf = hover_inf_list[i];
          if (hover_inf.obj == obj) {
            tippy_inf = hover_inf.tippy_inf;
            hover_inf_list.splice(i, 1);
          } else {
            hover_inf.tippy_inf.tooltips.forEach((a) => a.hide());
            i++;
          }
        }
        if (!tippy_inf) {
          tippy_inf = make_obj_tippy(this, obj);
        }
        opened_inf = { elm: this, obj, tippy_inf };
        set_view_state(null, curzoom, true)
          .then(() => {
            tippy_inf.tooltips.forEach((a) => a.show());
          });
      } else {
        opened_inf = null;
        set_view_state(null, curzoom, true);
      }
    });
  map_layer.selectAll(".map-point")
    .data(extra.highlight_points||[])
    .enter().append("circle")
		.attr("cx", (a) => projection(a.pos)[0])
	  .attr("cy", (a) => projection(a.pos)[1])
		.attr("r", "1")
		.attr("class", "map-point");
  set_view_state(null, curzoom, false);
  let zoom_btn = $get("ccg-map-zoom-btn");
  if (zoom_btn) {
    zoom_btn.addEventListener("click", zoom_onclick, false);
  }
  function get_origin (origin_bounds) {
    if (!origin_bounds && opened_inf) {
      origin_bounds = path.bounds(opened_inf.obj)
    } else if(!origin_bounds) {
      // origin fallback to highlighted features
      // else center
      if (ccg_highlighted_objs.length > 0) {
        origin_bounds = path.bounds({
          type: "FeatureCollection",
          features: ccg_highlighted_objs,
        });
      } else if(!origin_bounds) {
        origin_bounds = [ [ 0.49 * width, 0.49 * height ],
                          [ 0.51 * width, 0.51 * height ] ];
      }
    }
    return [
      origin_bounds[0][0] + (origin_bounds[1][0] - origin_bounds[0][0]) / 2,
      origin_bounds[0][1] + (origin_bounds[1][1] - origin_bounds[0][1]) / 2,
    ];
  }
  function zoom_onclick (evt) {
    evt.preventDefault();
    if (++curzoom > zooms.length)
      curzoom = minzoom;
    set_view_state(null, curzoom, true);
  }
  function set_view_state (origin, zoom, animate) {
    return new Promise((resolve) => {
      _set_view_state_resolves.push(resolve);
      if (origin == null) {
        origin = get_origin();
      }
      let zoomv = zooms[zoom-minzoom];
      let move = [ (-width * (zoomv - 1) / 2) / zoomv + (width/2 - origin[0]),
                   (-height * (zoomv - 1) / 2) / zoomv + (height/2 - origin[1]) ];
      (animate ? map_layer.transition().duration(500) : map_layer)
        .attr("transform", "scale(" + zooms[zoom-minzoom] + ") " +
              "translate(" + move.join(" ") + ")");
      map_layer.selectAll(".map-point")
		    .attr("r", (4 / Math.sqrt(zoomv))+"")
      if (_set_view_state_timeout != null)
        clearTimeout(_set_view_state_timeout);
      _set_view_state_timeout = setTimeout(() => {
        _set_view_state_timeout = null;
        for (let i = minzoom; i <= zooms.length; i++) {
          map_layer.classed("x" + i, i == zoom);
        }
        if (opened_inf) {
          opened_inf.tippy_inf.tooltips.forEach((a) => a.show());
        }
        hover_inf_list.forEach((hover_inf) => {
          hover_inf.tippy_inf.tooltips.forEach((a) => {
            if (a.state.visible)
              a.show();
          });
        });
        for (let resolve of _set_view_state_resolves) {
          resolve();
        }
        _set_view_state_resolves = [];
      }, 500);
    });
  }
  function init_obj_extra (obj) {
    // collect all ccgxxcd/nm to ccgcd/nm
    ["17","16"].forEach((a) => {
      if (!obj.properties.ccgcd && !!obj.properties["ccg" + a + "cd"]) {
        obj.properties.ccgcd = obj.properties["ccg" + a + "cd"];
      }
      if (!obj.properties.ccgnm && !!obj.properties["ccg" + a + "nm"]) {
        obj.properties.ccgnm = obj.properties["ccg" + a + "nm"];
      }
    });
    if (!obj.ccg_list && obj.properties.ccgcd) {
      let ccgcode = (obj.properties.ccgcd+"").toLowerCase()
      obj.ccgcode = ccgcode;
      obj.ccg_list = ccg_list.filter((a) => (a.ccgcodes||[]).indexOf(ccgcode) != -1);
      if (extra.input_service && extra.input_service != 'ALL') {
        obj.ccg_list = obj.ccg_list.filter((a)=>a.ccgservices.indexOf(extra.input_service.toLowerCase()) != -1)
      }
    } else if (!obj.ccg_list) {
      obj.ccg_list = [];
    }
  }
  function make_obj_tippy  (elm, obj) {
    // auto self-destruct at hidden, +hover_inf nullifier
    let tipelm = $new("div");
    tipelm.classList.add("ccg-tip");
    tipelm.innerHTML = tiptemplate(obj);
    let onHiddenHandler = function () { }
    let tippy_inf = tippy(elm, Object.assign({}, tippy_default_options, {
      html: tipelm,
      trigger: "manual",
      onHidden: () => {
        tippy_inf.destroyAll();
        let hover_inf_idx = hover_inf_list.findIndex((a) => a.tippy_inf == tippy_inf);
        if (hover_inf_idx != -1) {
          hover_inf_list.splice(hover_inf_idx, 1)[0];
        }
        onHiddenHandler();
      }
    }));
    let popper_elm = tippy_inf.tooltips[0].popper;
    popper_elm.addEventListener("mouseover", (evt) => {
      if (!opened_inf) {
        let hover_inf = hover_inf_list.find((a) => a.obj == obj);
        if (hover_inf) {
          if (hover_inf.hide_timeout != null) {
            clearTimeout(hover_inf.hide_timeout);
            hover_inf.hide_timeout = null;
          }
          hover_inf.tippy_inf.tooltips.forEach((a) => a.show());
        }
      }
    }, false);
    popper_elm.addEventListener("mouseout", (evt) => {
      let hover_inf = hover_inf_list.find((a) => a.obj == obj);
      if (hover_inf) {
        if (hover_inf.hide_timeout == null) {
          hover_inf.hide_timeout = setTimeout(() => {
            hover_inf.tippy_inf.tooltips.forEach((a) => a.hide());
            hover_inf.hide_timeout = null;
          }, get_tippy_delay(hover_inf.tippy_inf, "hide"));
        }
      }
    }, false);
    tipelm.addEventListener("click", (evt) => {
      let target = evt.target;
      if (target.classList.contains("ccgquery") && extra.ccg_lookup) {
        evt.preventDefault();
        tippy_inf.tooltips.forEach((a) => a.hide());
        onHiddenHandler = () => {
          let postcode = target.getAttribute("data-query");
          let postcodeinp = $get("ccg-postcode-input");
          if (postcodeinp) {
            if (typeof postcodeinp.scrollIntoView == "function") {
              postcodeinp.scrollIntoView();
            }
            postcodeinp.value = postcode;
          }
          extra.ccg_lookup(extra.input_service||"ALL", postcode)
            .catch((err) => {
              console.error(err);
              alert(err.message || err+"")
            });
        };
      }
    }, false);
    return tippy_inf;
  }
  return {
    svg,
    destroy: () => {
      map_layer.remove();
      if (zoom_btn) {
        zoom_btn.removeEventListener("click", zoom_onclick, false);
      }
    }
  };
}

function project_at (path, object, width, height) {
  let projection = path.projection();
  projection
    .scale(1)
    .translate([0, 0]);
  var b = path.bounds(object),
      s = .95 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
      t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];
  projection
    .scale(s)
    .translate(t);
}
