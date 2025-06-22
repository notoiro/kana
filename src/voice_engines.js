const shorthash = require('shorthash-jp');
const log4js = require('log4js');

const {
  VOICE_ENGINES
} = require('./config.js');

const Voicevox = require('./engine_loaders/voicevox.js');
const COEIROINKV2 = require('./engine_loaders/coeiroink_v2.js');

module.exports = class VoiceEngines{
  #logger;
  #engines;
  #liblary_engine_map;
  #speaker_engine_map;

  #engine_list;
  #short_id_map;
  #speakers;
  #safe_speakers;
  #liblarys;
  #safe_liblarys;
  #credit_urls;
  #infos;

  constructor(){
    this.#logger = log4js.getLogger('voice_engine_manager');
    this.#logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';

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
    for(let e of VOICE_ENGINES){
      const engine_obj = {
        name: e.name,
        api: null,
        version: "none",
        server: e.server,
        voice_list: [],
        voice_liblary_list: [],
        id_to_shortid_map: new Map(),
        original_list: [],
        credit_url: e.credit_url,
        queue: [],
        lock: false
      }

      switch(e.type){
        case "VOICEVOX":
          engine_obj.api = new Voicevox(e.server);
          break;
        case "COEIROINK_V2":
          engine_obj.api = new COEIROINKV2(e.server);
          break;
      }

      this.#logger.debug(JSON.stringify(engine_obj, null, "  "));

      this.#engines.set(engine_obj.name, engine_obj);
    }
  }

  async init_engines(){
    let shortid_voice = new Map();

    for(let e of this.#engines.values()){
      await e.api.check_version();
      e.version = e.api.version;

      const list = await e.api.speakers();

      e.original_list = JSON.parse(JSON.stringify(list));

      // NOTE: 多エンジン環境ではUUIDが一意ではないのでこちらで適当に一意にする（エンジンプラグイン側の実装はUUIDを別に持つので問題はない
      for(let l of e.original_list){
        l.speaker_uuid = `${e.name}_${l.speaker_uuid}`;
      }

      for(let sp of list){
        e.voice_liblary_list.push(sp.name);

        for(let v of sp.styles){
          let short = shorthash.unique(`${e.name}+${sp.speaker_uuid}+${v.id}`);
          let voice = v.id;

          let speaker = { name: `${sp.name}(${v.name})`, value: short };

          e.voice_list.push(speaker);
          e.id_to_shortid_map.set(voice, short);
          shortid_voice.set(short, { engine: e, id: voice });
        }
      }

      this.#short_id_map = shortid_voice;

      const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

      try{
        await e.api.synthesis("略して「帝国憲法」、明治に発布されたことから俗称として「明治憲法」とも。また、現行の日本国憲法との対比で旧憲法（きゅうけんぽう）とも呼ばれる。", shortid_voice.get(e.voice_list[0].value).id, tmp_voice);

        this.#logger.debug(`${e.name} OK`);
      }catch(e){
        this.#logger.info(e);
      }
    }

    this.#engine_list = this._engines();
    this.#speakers = this._speakers();
    this.#safe_speakers = this._safe_speakers();
    this.#liblarys = this._liblarys();
    this.#safe_liblarys = this._safe_liblarys();
    this.#credit_urls = this._credit_urls();
    this.#infos = this._engine_infos();

    this._setup__maps();
  }

  get engines(){
    return JSON.parse(JSON.stringify(this.engine_list));
  }

  get engine_list(){
    return JSON.parse(JSON.stringify(this.#engine_list));
  }

  get speakers(){
    return JSON.parse(JSON.stringify(this.#speakers));
  }

  get safe_speakers(){
    return JSON.parse(JSON.stringify(this.#safe_speakers));
  }

  get liblarys(){
    return JSON.parse(JSON.stringify(this.#liblarys));
  }

  get safe_liblarys(){
    return JSON.parse(JSON.stringify(this.#safe_liblarys));
  }

  get credit_urls(){
    return JSON.parse(JSON.stringify(this.#credit_urls));
  }

  get infos(){
    return JSON.parse(JSON.stringify(this.#infos));
  }

  get shortids(){
    return this.#short_id_map.keys();
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
      let speaker = { name: `${l.name}(${v.name})`, id: e.id_to_shortid_map.get(v.id) };
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

  _engine_infos(){
    let result = [];

    for(let e of this.#engines.values()){
      result.push({
        name: e.name,
        version: e.version,
        server: e.server,
        credit_url: e.credit_url,
      })
    }

    return result;
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

  // voice_idはshortidである
  synthesis(text, voice_id, param){
    const engine = this.#speaker_engine_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";

    return new Promise((resolve, reject) => {
        const queue = {
          text,
          voice_id,
          param,
          resolve,
          reject
        };

        engine.queue.push(queue);
        this.queue_start(engine);
    });
  }

  async queue_start(engine){
    if(!engine || engine.lock || engine.queue.length === 0) return;

    engine.lock = true;

    const q = engine.queue.shift();

    try{
      // 音量平均化実装が簡易化されたので_synthesisは廃止
      const id = this.#short_id_map.get(q.voice_id).id;
      const result = await engine.api.synthesis(q.text, id, q.param);
      q.resolve(result);
    }catch(e){
      q.reject(e);
    }

    engine.lock = false;
    this.queue_start(engine);
  }
}
