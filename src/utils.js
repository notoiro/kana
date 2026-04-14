const emoji_regex = require('emoji-regex');

const is_debug = !(process.env.NODE_ENV === "production");

class HTTPError extends Error{
  constructor(status, data, url){
    super(`HTTP Error: ${status}`);

    this.status = status;
    this.data = data;
    this.url = url;
    this.name = "HTTPError";
  }
}

module.exports = class Utils{
  static replace_url(text){
    return text.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi, 'ゆーあーるえる省略');
  }
  // Botの声設定の値をVoiceboxの値に変換する
  // 一応サンプルの範囲も制限するように
  static map_voice_setting(in_sample, out_min, out_max, in_min = 0, in_max = 200){
    let sample = Math.max(in_min, Math.min(in_sample, in_max));
    return (sample - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  static clean_message(text){
    let result = text;

    // カスタム絵文字
    result = result.replace(/<:([a-z0-9_-]+):[0-9]+>/gi, "$1");
    // 絵文字
    result = result.replace(emoji_regex(), "");
    // 記号
    result = result.replace(/["#'^\;:,|`{}<>]/g, "");
    // 改行
    result = result.replace(/\r?\n/g, "。")

    return result;
  }

  static sleep(waitTime){
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  static xor(a, b){
    return ((a || b) && !(a && b));
  }

  static async fetch_post(base, path, body, headers = {}, options = {}){
    const url = URL.parse(path, base);

    const { responseType = 'json', timeout = 10000, ...fetch_options } = options;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      ...fetch_options,
      signal: AbortSignal.timeout(options.timeout || 5000)
    });

    if(!res.ok){
      const text = await res.text().catch(() => 'No response body');
      throw new HTTPError(res.status, text, url);
    }

    if(res.status === 204) return null;

    let result = null;

    switch(responseType){
      case 'text':
        result = res.text();
        break;
      case 'arraybuffer':
        result = res.arrayBuffer();
        break;
      case 'json':
        result = res.json();
        break;
      default:
        result = res.text();
        break;
    }

    return result;
  }

  static async fetch_get(base, path, params = {}, headers = {}, options = {}){
    const url = URL.parse(path, base);

    const { is_json = false, timeout = 5000, ...fetch_options } = options;


    const query = new URLSearchParams(params).toString();
    const r_url = query ? `${url}?${query}` : url;

    if(is_json) headers['Accept'] = 'application/json';

    const res = await fetch(r_url, {
      method: 'GET',
      headers: headers,
      ...fetch_options,
      signal: AbortSignal.timeout(timeout)
    });

    if(!res.ok){
      const text = await res.text().catch(() => 'No response body');
      throw new HTTPError(res.status, text, r_url);
    }

    if(res.status === 204) return null;

    return is_json ? res.json() : res.text();
  }
}
