export let $get = (a) => document.getElementById(a)
export let $new = (a) => document.createElement(a)

export function http_get(url) {
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

