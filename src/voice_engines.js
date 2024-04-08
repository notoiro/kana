const {
  VOICE_ENGINES, TMP_DIR, TMP_PREFIX
} = require('../config.json');

const Voicevox = require('./engine_loaders/voicevox.js');
const COEIROINKV2 = require('./engine_loaders/coeiroink_v2.js');
const VolumeController = require('./volume_controller.js');

module.exports = class VoiceEngines{
  #logger;
  #engines;
  #liblary_engine_map;
  #speaker_engine_map;
  #speaker_volume_map;
  #reference_lufs;

  #engine_list;
  #speakers;
  #safe_speakers;
  #liblarys;
  #safe_liblarys;
  #credit_urls;
  #infos;

  constructor(logger){
    this.#logger = logger;

    if(VOICE_ENGINES){
      this.#engines = new Map();
      this.#liblary_engine_map = new Map();
      this.#speaker_engine_map = new Map();
      this.#speaker_volume_map = new Map();

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
        server: e.server,
        voice_list: [],
        voice_liblary_list: [],
        original_list: [],
        credit_url: e.credit_url,
        id_offset: count * 10000,
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

      count++;
    }
  }

  async init_engines(){
    for(let e of this.#engines.values()){
      await e.api.check_version();
      e.version = e.api.version;

      const list = await e.api.speakers();

      e.original_list = list;

      // NOTE: 多エンジン環境ではUUIDが一意ではないのでこちらで適当に一意にする（エンジンプラグイン側の実装はUUIDを別に持つので問題はない
      for(let l of e.original_list){
        l.speaker_uuid = `${e.name}_${l.speaker_uuid}`;
      }

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

        this.#logger.debug(`${e.name} OK`);
      }catch(e){
        this.#logger.info(e);
      }
    }

    await this.generate_reference_volume();

    this.#engine_list = this._engines();
    this.#speakers = this._speakers();
    this.#safe_speakers = this._safe_speakers();
    this.#liblarys = this._liblarys();
    this.#safe_liblarys = this._safe_liblarys();
    this.#credit_urls = this._credit_urls();
    this.#infos = this._engine_infos();

    this._setup__maps();
  }

  async generate_reference_volume(){
    const ref = Array.from(this.#engines.values())[0];
    const id = ref.voice_list[0].value - ref.id_offset;

    const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

    try{
      let samples = [];

      // 2つの系譜の異なる文章を読ませる
      // ここは起動時処理なのでキュー処理は考慮しない
      samples.push(await ref.api.synthesis("略して「帝国憲法」、明治に発布されたことから俗称として「明治憲法」とも。また、現行の日本国憲法との対比で旧憲法（きゅうけんぽう）とも呼ばれる。", `test_1_${ref.name}${TMP_PREFIX}.wav`, id, tmp_voice));
      samples.push(await ref.api.synthesis("にゃんにゃんにゃんにゃんにゃんにゃんにゃんにゃんにゃんにゃん", `test_2_${ref.name}${TMP_PREFIX}.wav`, id, tmp_voice));

      // ラウドネスを取得する
      const tests = [];
      for(let r of samples) tests.push(VolumeController.get_loud(r));

      const test_result = await Promise.all(tests);
      this.#reference_lufs = this.merge_lufs(test_result);
    }catch(e){
      throw e;
    }
  }

  async generate_reference_diff(voice_id){
    const map_item = this.#speaker_volume_map.get(voice_id);
    // 何か入ってるならスキップ（これはLOCKって入ってても同様の処理で大丈夫）
    if(map_item) return;

    this.#speaker_volume_map.set(voice_id, "LOCK");

    const ref = this.#speaker_engine_map.get(voice_id);

    const tmp_voice = { speed: 1, pitch: 0, intonation: 1, volume: 1 };

    try{
      const sample = await this.synthesis("略して「帝国憲法」、明治に発布されたことから俗称として「明治憲法」とも。また、現行の日本国憲法との対比で旧憲法（きゅうけんぽう）とも呼ばれる。", `test_1_${ref.name}_${ref.voice_id}${TMP_PREFIX}`, '.wav', voice_id, tmp_voice, true);

      // ラウドネスを取得する
      const loud = await VolumeController.diff_loud(sample, this.#reference_lufs);

      this.#speaker_volume_map.set(voice_id, loud);
    }catch(e){
      // リファレンスの差分データの生成に失敗した場合は何もしない
      // ここで引っかかる例ってほぼないだろうし、あったとしてもその場で処理できるエラーでもない
      // なおかつこの程度で終了かかるべきでもないのでログだけ出す
      this.#logger.info("Reference diff err");
      this.#logger.info(e);
    }
  }

  merge_lufs(lufs_settings){
    let lufs_setting = {
      input_i: 0,
      input_tp: 0,
      input_thresh: 0
    }
    for(let l of lufs_settings){
      lufs_setting.input_i      += parseFloat(l.input_i);
      lufs_setting.input_tp     += parseFloat(l.input_tp);
      lufs_setting.input_thresh += parseFloat(l.input_thresh);
    }

    lufs_setting.input_i =      lufs_setting.input_i      / lufs_settings.length;
    lufs_setting.input_tp =     lufs_setting.input_tp     / lufs_settings.length;
    lufs_setting.input_thresh = lufs_setting.input_thresh / lufs_settings.length;

    return lufs_setting;
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

  synthesis(text, filename_base, ext, voice_id, param, pass_volume_controll = false){
    const engine = this.#speaker_engine_map.get(voice_id);
    if(engine === undefined) throw "Unknown Engine or Voice";

    return new Promise((resolve, reject) => {
        const queue = {
          text,
          filename_base,
          ext,
          voice_id,
          param,
          pass_volume_controll,
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
      const result = await this._synthesis(engine, q.text, q.filename_base, q.ext, q.voice_id, q.param, q.pass_volume_controll);
      q.resolve(result);
    }catch(e){
      q.reject(e);
    }

    engine.lock = false;
    this.queue_start(engine);
  }

  async _synthesis(engine, text, filename_base, ext, voice_id, param, pass_volume_controll = false){
    const id = voice_id - engine.id_offset;
    const volume = this.#speaker_volume_map.get(voice_id);

    try{
      const v = engine.api.synthesis(text, `${filename_base}_orig${ext}`, id, param);

      // 生成中なら無視して返す
      if(pass_volume_controll || volume === 'LOCK'){
        this.#logger.debug('pass volume controll');
        return await v;
      }
      // 未生成なら生成叩いて返す
      if(!volume){
        this.#logger.debug('generate volume controll')
        this.generate_reference_diff(voice_id);
        return await v;
      }

      const filepath = await v;

      this.#logger.debug('set loud')
      return await VolumeController.set_loud(filepath, `${TMP_DIR}/${filename_base}${ext}`, this.#reference_lufs, volume.input_thresh, volume.target_offset)
    }catch(e){
      throw e;
    }
  }
}
