const {
  VOICE_ENGINES, TMP_DIR, TMP_PREFIX
} = require('../config.json');

const Voicevox = require('./voicevox.js');
const COEIROINKV2 = require('./coeiroink_v2.js');

module.exports = class VoiceEngines{
  constructor(logger){
    this.logger = logger;

    if(VOICE_ENGINES){
      this.engines = [];
      this.voice_map = new Map();
      this.load_engines();
    }else{
      throw "Engine Err";
    }
  }

  load_engines(){
    let count = 0;
    for(let e of VOICE_ENGINES){
      const engine_obj = {
        name: e.name,
        api: null,
        version: "none",
        voice_list: [],
        voice_liblary_list: [],
        id_offset: count * 10000
      }

      switch(e.type){
        case "VOICEVOX":
          engine_obj.api = new Voicevox(e.url);
          break;
        case "COEIROINK_V2":
          engine_obj.api = new COEIROINKV2(e.url);
          engine_obj.voice_list_orig = [];
      }

      this.logger.debug(JSON.stringify(engine_obj, null, "  "));

      this.engines.push(engine_obj);

      count++;
    }
  }

  async init_engines(){
    for(let e of this.engines){
      await e.api.check_version();
      e.version = e.api.version;

      const list = await e.api.speakers();

      console.log(JSON.stringify(list, null, "  "))

      for(let sp of list){

        e.voice_liblary_list.push(sp.name);

        for(let v of sp.styles){
          let speaker = { name: `${sp.name}(${v.name})`, value: parseInt(v.id, 10) + e.id_offset };
          e.voice_list.push(speaker);
        }
      }

      const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

      try{
        await e.api.synthesis("てすと", `test_${e.name}${TMP_PREFIX}.wav`, e.voice_list[0].value - e.id_offset, tmp_voice);

        this.logger.debug(`${e.name} loaded.`);
      }catch(e){
        this.logger.info(e);
      }
    }

    this.speakers = this._speakers();
    this.safe_speakers = this._safe_speakers();
    this.liblarys = this._liblarys();
    this.safe_liblarys = this._safe_liblarys();

    this._setup_voice_map();
  }

  _speakers(){
    let result = [];
    for(let e of this.engines){
      result = result.concat(e.voice_list);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _safe_speakers(){
    let result = [];
    for(let e of this.engines){
      let fix_lists = JSON.parse(JSON.stringify(e.voice_list)).map((v) => {
        v.name = `${e.name}:${v.name}`;
        return v;
      });
      result = result.concat(fix_lists);
    }

    return result;
  }

  _liblarys(){
    let result = [];
    for(let e of this.engines){
      result = result.concat(e.voice_liblary_list);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _safe_liblarys(){
    let result = [];
    for(let e of this.engines){
      let fix_lists = JSON.parse(JSON.stringify(e.voice_liblary_list)).map((v) => `${e.name}:${v}`);
      result = result.concat(fix_lists);
    }

    return result;
  }

  _setup_voice_map(){
    for(let e of this.engines){
      for(let v of e.voice_list){
        this.voice_map.set(v.value, e);
      }
    }
  }

  async synthesis(text, filename, voice_id, param){
    const engine = this.voice_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";

    const id = voice_id - engine.id_offset;

    try{
      return await engine.api.synthesis(text, filename, id, param);
    }catch(e){
      throw e;
    }
  }
}
