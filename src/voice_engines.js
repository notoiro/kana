const shorthash = require('shorthash-jp');
const log4js = require('log4js');

const {
  VOICE_ENGINES
} = require('./config.js');

// VOICE
const Voicevox = require('./engine_loaders/voicevox.js');
const COEIROINKV2 = require('./engine_loaders/coeiroink_v2.js');
// VOCAL
const VoicevoxSong = require('./engine_loaders/voicevox_song.js');

const MixUtils = require('./mix_utils.js');

const TEST_SONG = `
こころにきざんだきみのいろ:t172,o4,f+4,e8,e4,d+4,e4.,g+4,f+4,e4,f+4,g+8,f+4,e4,g+4.;
きみといきたきおくわわたしのたからもの:r4,e4,e4,b4,b8,b4,b4,b4.,g+4,f+4,e4,f+4,e8,f+4,g+4,a4.,b4,g+8,g+8,f+8;
かなたえたびだつきみえのうた:r8,f+4,e8,e4,d+4,e4.,g+4,f+4,e4,f+4,g+8,f+4,e8,e8,g+4.;
きみとすごしたひびにたくさんの:r4,e4,e4,b4,b8,b4,b4,b4.,g+4,f+4,e4,f+4,e8,f+4,g+4,a4;
ありがとお:r8,b4,g+4,f+4,f+4.,e1^4.;
たいせつなきみえ:r4,b4,a4,a4,g+4,f+4,r4,e4,d+4,e1^1;
`;
const Utils = require('./utils.js');

module.exports = class VoiceEngines{
  #logger;
  #engines;
  #library_engine_map;
  #speaker_engine_map;

  #engine_list;
  #short_id_map;
  #short_id_song_map;
  #speakers;
  #safe_speakers;
  #singers;
  #sing_libraries;
  #libraries;
  #safe_libraries;
  #credit_urls;
  #infos;

  constructor(){
    this.#logger = log4js.getLogger('voice_engine_manager');
    this.#logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';

    if(VOICE_ENGINES){
      this.#engines = new Map();
      this.#library_engine_map = new Map();
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
        voice_library_list: [],
        id_to_shortid_map: new Map(),
        original_list: [],
        credit_url: e.credit_url,
        queue: [],
        lock: false,
        is_song: false
      }

      switch(e.type){
        case "VOICEVOX":
          engine_obj.api = new Voicevox(e.server);
          engine_obj.is_song = false;
          break;
        case "COEIROINK_V2":
          engine_obj.api = new COEIROINKV2(e.server);
          engine_obj.is_song = false;
          break;
        case "VOICEVOX_SONG":
          engine_obj.api = new VoicevoxSong(e.server);
          engine_obj.is_song = true;
      }

      this.#logger.debug(JSON.stringify(engine_obj, null, "  "));

      this.#engines.set(engine_obj.name, engine_obj);
    }
  }

  async init_engines(){
    let shortid_voice = new Map();
    let shortid_sing = new Map();

    const engine_promises = Array.from(this.#engines.values()).map(async (e) => {
      try {
        await e.api.check_version();
        e.version = e.api.version;

        const list = await e.api.speakers();
        e.original_list = JSON.parse(JSON.stringify(list));

        for(let l of e.original_list){
          l.speaker_uuid = `${e.name}_${l.speaker_uuid}`;
        }

        for(let sp of list){
          e.voice_library_list.push(sp.name);

          for(let v of sp.styles){
            let short = shorthash.unique(`${e.name}+${sp.speaker_uuid}+${v.id}`);
            let voice = v.id;

            let speaker = { name: `${sp.name}(${v.name})`, value: short };

            e.voice_list.push(speaker);
            e.id_to_shortid_map.set(voice, short);
            if(!e.is_song) shortid_voice.set(short, { engine: e, id: voice });
            else shortid_sing.set(short, { engine: e, id: voice });
          }
        }

        const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

        if(e.is_song){
          await e.api.synthesis(TEST_SONG, shortid_sing.get(e.voice_list[0].value).id);
        }else{
          await e.api.synthesis("略して「帝国憲法」、明治に発布されたことから俗称として「明治憲法」とも。また、現行の日本国憲法との対比で旧憲法（きゅうけんぽう）とも呼ばれる。", shortid_voice.get(e.voice_list[0].value).id, tmp_voice);
        }

        return { status: 'fulfilled', engine: e.name, version: e.version };
      } catch (err) {
        return { status: 'rejected', engine: e.name, reason: Utils.handle_axios_error(err) };
      }
    });

    const results = await Promise.all(engine_promises);
    const failed_engines = results.filter(r => r.status === 'rejected');

    if(failed_engines.length > 0) {
      this.#logger.info("--- Voice Engine Initialization Report ---");
      for(const result of results){
        if(result.status === 'fulfilled'){
          this.#logger.info(`✓ ${result.engine} (Version: ${result.version}) - Successfully initialized.`);
        }else{
          const reason_str = typeof result.reason === 'object' ? JSON.stringify(result.reason, null, 2) : result.reason;
          this.#logger.error(`✗ ${result.engine} - Failed to initialize. Reason: ${reason_str}`);
        }
      }
      this.#logger.info("----------------------------------------");
      this.#logger.fatal("One or more voice engines failed to initialize. The application will now exit.");
      process.exit(1);
    }

    this.#short_id_map = shortid_voice;
    this.#short_id_song_map = shortid_sing;

    this.#engine_list = this._engines();
    this.#speakers = this._speakers();
    this.#safe_speakers = this._safe_speakers();
    this.#singers = this._singers();
    this.#sing_libraries = this._sing_libraries();
    this.#libraries = this._libraries();
    this.#safe_libraries = this._safe_libraries();
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

  get libraries(){
    return JSON.parse(JSON.stringify(this.#libraries));
  }

  get safe_libraries(){
    return JSON.parse(JSON.stringify(this.#safe_libraries));
  }

  get singers(){
    return JSON.parse(JSON.stringify(this.#singers));
  }

  get sing_libraries(){
    return JSON.parse(JSON.stringify(this.#sing_libraries));
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

  get_engine_libraries(engine_name){
    const e = this.#engines.get(engine_name);

    if(!e) throw "Engine not found";

    let result = [];

    for(let l of e.original_list){
      result.push({ name: l.name, id: l.speaker_uuid });
    }

    return JSON.parse(JSON.stringify(result));
  }

  get_library_speakers(library_id){
    const e = this.#library_engine_map.get(library_id);

    if(!e) throw "Engine not found";

    const l = e.original_list.find(l => library_id === l.speaker_uuid);

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
      if(e.is_song) continue;
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
      if(e.is_song) continue;
      let fix_lists = JSON.parse(JSON.stringify(e.voice_list)).map((v) => {
        v.name = `${e.name}:${v.name}`;
        return v;
      });
      result = result.concat(fix_lists);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _libraries(){
    let result = [];
    for(let e of this.#engines.values()){
      if(e.is_song) continue;
      let list = JSON.parse(JSON.stringify(e.voice_library_list));
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

  _safe_libraries(){
    let result = [];
    for(let e of this.#engines.values()){
      if(e.is_song) continue;
      let fix_lists = JSON.parse(JSON.stringify(e.voice_library_list)).map((v) => `${e.name}:${v}`);
      result = result.concat(fix_lists);
    }

    return JSON.parse(JSON.stringify(result));
  }

  _singers(){
    let result = [];
    for(let e of this.#engines.values()){
      if(!e.is_song) continue;
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

  _sing_libraries(){
    let result = [];
    for(let e of this.#engines.values()){
      if(!e.is_song) continue;
      let list = JSON.parse(JSON.stringify(e.voice_library_list));
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

  _engines(){
    let result = [];
    for(let e of this.#engines.values()){
      if(e.is_song) continue;
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
        song: e.is_song
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
        this.#library_engine_map.set(l.speaker_uuid, e);
      }
    }
  }

  // voice_idはshortidである
  synthesis(text, voice_id, param){
    const engine = this.#speaker_engine_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";
    if(engine.is_song) throw "I'm a talk engine";

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

  // TODO: no_file_use
  // voice_idはshortidである
  song_synthesis(text, voice_id){
    const engine = this.#speaker_engine_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";
    if(!engine.is_song) throw "I'm a sing engine";

    return new Promise((resolve, reject) => {
        const queue = {
          text,
          voice_id,
          resolve,
          reject
        };

        engine.queue.push(queue);
        this.song_queue_start(engine);
    });
  }

  async song_queue_start(engine){
    if(!engine || engine.lock || engine.queue.length === 0) return;

    engine.lock = true;

    const q = engine.queue.shift();

    try{
      const result = await this._song_synthesis(engine, q.text, q.voice_id);
      q.resolve(result);
    }catch(e){
      q.reject(e);
    }

    engine.lock = false;
    this.song_queue_start(engine);
  }

  // voice_idはshortidである
  async _song_synthesis(engine, text, voice_id){
    const id = this.#short_id_song_map.get(voice_id).id;

    try{
      const v = engine.api.synthesis(text, id);

      return await v;
    }catch(e){
      throw e;
    }
  }

  async vml_synthesis(song){
    let buffer = null;

    try{
      if(song.length === 1){
        buffer = await this.song_synthesis(song[0].score, song[0].singer);
      }else{
        // マルチトラックの場合
        let tracks = [];
        for(let s of song){
          const buffer = await this.song_synthesis(s.score, s.singer);

          tracks.push({ buffer, gain: s.gain });
        }

        buffer = await MixUtils.mix(tracks);
      }
    }catch(e){
      throw e;
    }

    return buffer;
  }
}
