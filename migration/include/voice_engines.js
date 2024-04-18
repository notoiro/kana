const { VOICE_ENGINES } = require('../../config.json');

const Voicevox = require('../../src/engine_loaders/voicevox.js');
const COEIROINKV2 = require('../../src/engine_loaders/coeiroink_v2.js');

const shorthash = require('shorthash-jp');

module.exports = class VoiceEngines{
  #engines;
  #id_map;

  constructor(){
    if(VOICE_ENGINES){
      this.#engines = new Map();
      this.load_engines();
    }else{
      throw "Engine Err";
    }
  }

  load_engines(){
    this.#id_map = new Map();
    let count = 0;
    for(let e of VOICE_ENGINES){
      const engine_obj = {
        name: e.name,
        api: null,
        server: e.server,
        id_offset: count * 10000,
      }

      switch(e.type){
        case "VOICEVOX":
          engine_obj.api = new Voicevox(e.server);
          break;
        case "COEIROINK_V2":
          engine_obj.api = new COEIROINKV2(e.server);
          break;
      }

      this.#engines.set(engine_obj.name, engine_obj);

      count++;
    }
  }

  async init_engines(){
    for(let e of this.#engines.values()){
      const list = await e.api.speakers();

      for(let sp of list){
        for(let v of sp.styles){
          let short = shorthash.unique(`${e.name}+${sp.speaker_uuid}+${v.id}`);
          let speaker = parseInt(v.id, 10) + e.id_offset;

          this.#id_map.set(speaker, short);
        }
      }
    }
  }

  shortid(sp_id){
    return this.#id_map.get(sp_id);
  }
}
