const {
  VOICE_ENGINES, TMP_DIR, TMP_PREFIX
} = require('../config.json');

const Voicevox = require('./voicevox.js');
const COEIROINKV2 = require('./coeiroink_v2.js');

module.exports = class VoiceEngines{
  #engines;
  #liblary_engine_map;
  #speaker_engine_map;

  constructor(logger){
    this.logger = logger;

    if(VOICE_ENGINES){
      this.#engines = new Map();
      this.#liblary_engine_map = new Map();
      this.#speaker_engine_map = new Map();

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
        original_list: [],
        credit_url: e.credit_url,
        id_offset: count * 10000
      }

      switch(e.type){
        case "VOICEVOX":
          engine_obj.api = new Voicevox(e.server);
          break;
        case "COEIROINK_V2":
          engine_obj.api = new COEIROINKV2(e.server);
          break;
      }

      this.logger.debug(JSON.stringify(engine_obj, null, "  "));

      this.#engines.set(engine_obj.name, engine_obj);

      count++;
    }
  }

  async init_engines(){
    for(let e of this.#engines.values()){
      await e.api.check_version();
      e.version = e.api.version;

      const list = await e.api.speakers();

      e.original_list = list;

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

        this.logger.debug(`${e.name} OK`);
      }catch(e){
        this.logger.info(e);
      }
    }

    this.engine_list = this._engines();
    this.speakers = this._speakers();
    this.safe_speakers = this._safe_speakers();
    this.liblarys = this._liblarys();
    this.safe_liblarys = this._safe_liblarys();
    this.credit_urls = this._credit_urls();

    this._setup__maps();
  }

  get engines(){
    return JSON.parse(JSON.stringify(this.engine_list));
  }

  get_engine_liblarys(engine_name){
    const e = this.#engines.get(engine_name);

    if(!e) throw "Engine not found";

    let result = [];

    for(let l of e.original_list){
      result.push({ name: l.name, id: l.speaker_uuid });
    }

    return JSON.parse(JSON.stringify(result));
  }

  get_liblary_speakers(liblary_id){
    const e = this.#liblary_engine_map.get(liblary_id);

    if(!e) throw "Engine not found";

    const l = e.original_list.find(l => liblary_id === l.speaker_uuid);

    let result = [];
    for(let v of l.styles){
      let speaker = { name: `${l.name}(${v.name})`, id: `${parseInt(v.id, 10) + e.id_offset}` };
      result.push(speaker);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _speakers(){
    let result = [];
    for(let e of this.#engines.values()){
      let list = JSON.parse(JSON.stringify(e.voice_list));
      for(let v of list){
        if(!result.some(vv => vv.name === v.name)){
          result.push(v);
        }else{
          v.name = `${e.name}:${v.name}`;
          result.push(v);
        }
      }
    }

    return JSON.parse(JSON.stringify(result));
  }

  _safe_speakers(){
    let result = [];
    for(let e of this.#engines.values()){
      let fix_lists = JSON.parse(JSON.stringify(e.voice_list)).map((v) => {
        v.name = `${e.name}:${v.name}`;
        return v;
      });
      result = result.concat(fix_lists);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _liblarys(){
    let result = [];
    for(let e of this.#engines.values()){
      let list = JSON.parse(JSON.stringify(e.voice_liblary_list));
      for(let v of list){
        if(!result.some(vv => vv === v)){
          result.push(v);
        }else{
          v = `${e.name}:${v}`;
          result.push(v);
        }
      }
    }

    return JSON.parse(JSON.stringify(result));
  }

  _safe_liblarys(){
    let result = [];
    for(let e of this.#engines.values()){
      let fix_lists = JSON.parse(JSON.stringify(e.voice_liblary_list)).map((v) => `${e.name}:${v}`);
      result = result.concat(fix_lists);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _engines(){
    let result = [];
    for(let e of this.#engines.values()){
      result.push(e.name);
    }

    return result;
  }

  _credit_urls(){
    let result = [];
    for(let e of this.#engines.values()){
      if(!result.some(c => c === e.credit_url)){
        result.push(e.credit_url);
      }
    }

    return JSON.parse(JSON.stringify(result));
  }

  _setup__maps(){
    for(let e of this.#engines.values()){
      for(let v of e.voice_list){
        this.#speaker_engine_map.set(v.value, e);
      }
      for(let l of e.original_list){
        this.#liblary_engine_map.set(l.speaker_uuid, e);
      }
    }
  }

  async synthesis(text, filename, voice_id, param){
    const engine = this.#speaker_engine_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";

    const id = voice_id - engine.id_offset;

    try{
      return await engine.api.synthesis(text, filename, id, param);
    }catch(e){
      throw e;
    }
  }
}
