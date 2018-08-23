import "promise-polyfill/src/polyfill";
import "whatwg-fetch";
import "classlist-polyfill";
import "babel-polyfill";

// ajax shim
var ids = ["Msxml2.XMLHTTP", "Microsoft.XMLHTTP", "Msxml2.XMLHTTP.4.0"];
if (typeof XMLHttpRequest === "undefined") {
  for (var i = 0; i < ids.length; i++) {
    try {
      new ActiveXObject(ids[i]);
      window.XMLHttpRequest = function() {
        return new ActiveXObject(ids[i]);
      };
      break;
    } catch (e) {}
  }
}

// There's an issue with IE, instead of Node having prototype contains,
// HTMLElement has it. Simple fix is to set the function for Node too
if (typeof Node != 'undefined' && typeof HTMLElement != 'undefined' &&
    !Node.prototype.contains && HTMLElement.prototype.contains) {
  Node.prototype.contains = HTMLElement.prototype.contains;
}
