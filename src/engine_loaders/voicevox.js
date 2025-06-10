const { default: axios } = require('axios');

module.exports = class Voicevox{
  #rpc;
  #version;

  constructor(host){
    this.#rpc = axios.create({baseURL: host, proxy: false});
    this.#version = "Unknown";
  }

  get version(){
    return this.#version;
  }

  async check_version(){
    try{
      this.#version = await this.#rpc.get('version');
      this.#version = this.#version.data;
    }catch(e){
      throw e;
    }
  }

  async speakers(){
    let result;
    try{
      result = await this.#rpc.get('speakers', {headers: { 'accept': 'application/json' }});
    }catch(e){
      throw e;
    }

    return result.data;
  }

  // param: Object
  //   speed: Num
  //   pitch: Num
  //   intonation: Num
  //   volume: Num
  async synthesis(text, voice_id, param){
    try{
      const query = await this.#rpc.post(`audio_query?text=${encodeURIComponent(text)}&speaker=${voice_id}`, {headers: { 'accept': 'application/json' }});

      const query_data = query.data;

      query_data.speedScale = param.speed;
      query_data.pitchScale = param.pitch;
      query_data.intonationScale = param.intonation;
      query_data.volumeScale = param.volume;

      const synth = await this.#rpc.post(`synthesis?speaker=${voice_id}`, JSON.stringify(query_data), {
        responseType: 'arraybuffer',
        headers: {
          "accept": "audio/wav",
          "Content-Type": "application/json"
        }
      });

      return new Uint8Array(synth.data).buffer;
    }catch(e){
      throw e;
    }
  }
}

