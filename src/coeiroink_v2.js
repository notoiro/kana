const { default: axios } = require('axios');
const fs = require('fs');

const {
  TMP_DIR
} = require('../config.json');
const { AxiosError } = require('axios');

module.exports = class COEIROINKV2{
  constructor(host){
    this.rpc = axios.create({baseURL: host, proxy: false});
    this.version = "Unknown";

    this.voice_map = new Map();
  }

  async check_version(){
    try{
      this.version = await this.rpc.get('v1/engine_info');
      this.version = this.version.data.version;
    }catch(e){
      throw e;
    }
  }

  async speakers(){
    let result;
    try{
      result = await this.rpc.get('v1/speakers', {headers: { 'accept': 'application/json' }});

      this._voice_list = this._create_voicevox_speakers(result.data);
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

        this.voice_map.set(s_new.id, v_new.speaker_uuid);

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
  async synthesis(text, filename, style_id, param){
    try{
      const query = await this.rpc.post(`v1/estimate_prosody`, JSON.stringify({text: text}), { headers: { 'Content-Type': 'application/json' }});

      const q = query.data;

      const query_data = {
        text: "",
        prosodyDetail: q.detail,
        speakerUuid: this.voice_map.get(style_id),
        styleId: style_id,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 44100
      };

      query_data.speedScale = param.speed;
      query_data.pitchScale = param.pitch;
      query_data.intonationScale = param.intonation;
      query_data.volumeScale = param.volume;

      const synth = await this.rpc.post(`v1/synthesis`, JSON.stringify(query_data), {
        responseType: 'arraybuffer',
        headers: {
          "accept": "audio/wav",
          "Content-Type": "application/json"
        }
      });

      const file_path = `${TMP_DIR}/${filename}`;
      fs.writeFileSync(file_path, new Buffer.from(synth.data), 'binary');

      return file_path;
    }catch(e){
      if(e instanceof AxiosError){
        console.log(JSON.stringify(e.response?.data, null, "  "));
      }
      throw e;
    }
  }
}

