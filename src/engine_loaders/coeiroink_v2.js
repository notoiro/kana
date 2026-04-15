const Utils = require('../utils.js');

module.exports = class COEIROINKV2{
  #voice_map;
  #version;
  #host;
  #timeout;

  constructor(host, timeout){
    this.#host = host;
    this.#timeout = timeout;
    this.#version = "Unknown";

    this.#voice_map = new Map();
  }

  get version(){
    return this.#version;
  }

  async check_version(){
    try{
      const version = await Utils.fetch_get(this.#host, '/v1/engine_info', {}, {}, { is_json: true });
      this.#version = `${version.version}(${version.device})`;
    }catch(e){
      throw e;
    }
  }

  async speakers(){
    let result;
    try{
      result = await Utils.fetch_get(this.#host, '/v1/speakers', {}, {}, { is_json: true });

      this._voice_list = this._create_voicevox_speakers(result);
    }catch(e){
      throw e;
    }

    return this._voice_list;
  }

  async _create_voicevox_speakers(data){
    let result = [];
    for(let v of data){
      let v_new = {
        name: v.speakerName,
        speaker_uuid: v.speakerUuid,
        version: v.version,
        styles: [],
      };

      for(let s of v.styles){
        let s_new = {
          name: s.styleName,
          id: s.styleId
        };

        this.#voice_map.set(s_new.id, v_new.speaker_uuid);

        v_new.styles.push(s_new);
      }

      result.push(v_new);
    }

    return result;
  }

  // param: Object
  //   speed: Num
  //   pitch: Num
  //   intonation: Num
  //   volume: Num
  async synthesis(text, style_id, param){
    try{
      const query = await Utils.fetch_post(this.#host, '/v1/estimate_prosody', {text: text}, {}, { timeout: 5000 });

      const predict_body = {
        speakerUuid: this.#voice_map.get(style_id),
        styleId: style_id,
        text: text,
        prosodyDetail: query.detail,
        speedScale: param.speed
      };

      const predict = await Utils.fetch_post(this.#host, '/v1/predict_with_duration', predict_body, {}, { timeout: this.#timeout });

      const query_data = {
        text: "",
        prosodyDetail: query.detail,
        speakerUuid: this.#voice_map.get(style_id),
        styleId: style_id,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 41100,
        sampledIntervalValue: 3,
        processingAlgorithm: "world",
        startTrimBuffer: predict.startTrimBuffer,
        endTrimBuffer: predict.endTrimBuffer,
        pauseLength: 0.1,
        wavBase64: predict.wavBase64,
        moraDurations: predict.moraDurations
      };

      query_data.speedScale = param.speed;
      query_data.pitchScale = param.pitch;
      query_data.intonationScale = param.intonation;
      query_data.volumeScale = param.volume;

      const synth = await Utils.fetch_post(this.#host, '/v1/process', query_data, { 'Accept': 'audio/wav' }, { responseType: 'arraybuffer', timeout: this.#timeout });

      return new Uint8Array(synth).buffer;
    }catch(e){
      throw e;
    }
  }
}

