const Utils = require('../utils.js');

module.exports = class Voicevox{
  #host;
  #version;
  #timeout;

  constructor(host, timeout){
    this.#host = host;
    this.#timeout = timeout;
    this.#version = "Unknown";
  }

  get version(){
    return this.#version;
  }

  async check_version(){
    try{
      const version = await Utils.fetch_get(this.#host, '/version');
      this.#version = version.replace(/"/g, "");
    }catch(e){
      throw e;
    }
  }

  async speakers(){
    let result;
    try{
      result = await Utils.fetch_get(this.#host, '/speakers', {}, {}, { is_json: true });
    }catch(e){
      throw e;
    }

    return result;
  }

  // param: Object
  //   speed: Num
  //   pitch: Num
  //   intonation: Num
  //   volume: Num
  async synthesis(text, voice_id, param){
    try{
      const query = await Utils.fetch_post(this.#host, `/audio_query?text=${encodeURIComponent(text)}&speaker=${voice_id}`);

      query.speedScale = param.speed;
      query.pitchScale = param.pitch;
      query.intonationScale = param.intonation;
      query.volumeScale = param.volume;

      const synth = await Utils.fetch_post(this.#host, `/synthesis?speaker=${voice_id}`, query, { 'Accept': 'audio/wav' }, { responseType: 'arraybuffer', timeout: this.#timeout });

      return new Uint8Array(synth).buffer;
    }catch(e){
      throw e;
    }
  }
}

