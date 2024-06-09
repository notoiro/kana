const ffmpeg = require('fluent-ffmpeg');

module.exports = class VolumeController{
  static get_silenceremove_mp3(path, out_path, threshold = '-40dB'){
    return new Promise((resolve, reject) => {
        const options = [
          '-vn',
          '-threads', '1',
          '-y',
          '-af',
          `silenceremove=window=0:detection=peak:stop_mode=all:start_mode=all:stop_periods=-1:start_periods=1:stop_threshold=${threshold}:start_threshold=${threshold}`,
          '-hide_banner', '-nostats', '-loglevel', 'warning' // optimize
        ];

        ffmpeg()
          .input(path)
          .outputOption(options)
          .saveToFile(out_path)
          .on('end', () => { resolve(out_path) })
          .on('error', (err) => { reject(err) });
    })
  }

  static get_loud(path){
    // NOTE:
    // 仕様上Promise内でawaitは使うべきでなく、Promise内でthrowされた場合はrejectではなくunhandledRejectionになる。
    // 修正としてはasyncを使わないことだが、本実装においてはasyncを使わない場合あまりに汚い実装になるため、
    // 気休めの回避策として手動でcatchしてrejectにいれてやることにする。
    // おそらく手動でcatchしてrejectした場合にはreject扱いになってくれる気がするので…
    // See https://tyru.hatenablog.com/entry/2018/08/04/220530
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let sample;
        try{
          sample = await VolumeController.get_silenceremove_mp3(path, `${path}.mp3`);
        }catch(e){
          reject(e);
        }
        const options = [
          '-vn',
          '-threads', '1',
          '-af',
          `loudnorm=print_format=json`,
          '-hide_banner', '-nostats',  // optimize
          '-f null'
        ];

        ffmpeg()
          .input(sample)
          .output('-')
          .outputOption(options)
          .on('end', (_, r) => { resolve(VolumeController.parse_json_log(r)) })
          .on('error', (err) => { reject(err) })
          .run();
    });
  }

  static diff_loud(path, lufs_settings){
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let sample;

        try{
          sample = await VolumeController.get_silenceremove_mp3(path, `${path}.mp3`);
        }catch(e){
          reject(e);
        }

        const options = [
          '-vn',
          '-threads', '1',
          '-af',
          `loudnorm=I=${lufs_settings.input_i}:TP=${lufs_settings.input_tp}:print_format=json`,
          '-hide_banner', '-nostats',  // optimize
          '-f null'
        ];

        ffmpeg()
          .input(sample)
          .output('-')
          .outputOption(options)
          .on('end', (_, r) => { resolve(VolumeController.parse_json_log(r)) })
          .on('error', (err) => { reject(err) })
          .run();
    });
  }

  static set_loud(path, out_path, lufs_settings, thresh, offset){
    return new Promise((resolve, reject) => {
        const options = [
          '-vn',
          '-threads', '2',
          '-af',
          `loudnorm=I=${lufs_settings.input_i}:TP=${lufs_settings.input_tp}:measured_thresh=${thresh}:offset=${offset}:print_format=json`,
          '-y',
          '-hide_banner', '-nostats', '-loglevel', 'warning' // optimize
        ];

        ffmpeg()
          .input(path)
          .output(out_path)
          .outputOption(options)
          .on('end', (_, r) => { resolve(out_path) })
          .on('error', (err) => { reject(err) })
          .run()
    });
  }

  static parse_json_log(input){
    const input_arr = input.split('\n').reverse();

    let flag = false;
    let result = [];
    for(let l of input_arr){
      if(l === '}') flag = true;
      if(l === '{'){
        result.push(l);
        flag = false;
      }

      if(flag) result.push(l);
    }

    return JSON.parse(result.reverse().join('\n'));
  }
}



