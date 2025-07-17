const emoji_regex = require('emoji-regex');

const is_debug = !(process.env.NODE_ENV === "production");

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

  static handle_axios_error(err){
    if (!err.isAxiosError) {
      return err; // Axiosエラーでなければそのまま返す
    }

    let report = {};
    if (err.response) {
      // サーバーからの応答があったが、ステータスコードが2xxの範囲外
      report = {
        message: `Request failed with status code ${err.response.status}`,
        status: err.response.status,
        data: err.response.data
      };
    } else if (err.request) {
      // リクエストは行われたが、応答がなかった
      report = {
        message: 'No response was received from the server.',
        code: err.code,
        request_info: {
          address: err.request._options.hostname,
          port: err.request._options.port,
          path: err.request._options.path
        }
      };
    } else {
      // リクエストの設定中に何かが発生した
      report = { message: err.message };
    }

    if (is_debug && err.stack) {
      report.debug_stack = err.stack.split('\n');
    }

    return report; // 整形したオブジェクトを返す
  }
}
