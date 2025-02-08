const { VML } = require('vml');
const { default: axios } = require('axios');
const fs = require('fs');
const { OfflineAudioContext } = require('node-web-audio-api');
const toWav = require('audiobuffer-to-wav');

const { TMP_DIR } = require('../../config.json');

const linear_interpolation = (x1, y1, x2, y2, x,) => {
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

// 本家と違ってフェードアウト対象の休符の長さは固定なので1フレーム想定はしない。
const fadeout = (query, score, length) => {
  let start = 0;
  for(let i = 0; i < score.length -1; i++) start += score[i].frame_length;
  const f_length = score[score.length -1].frame_length;

  for(let i = 0; i < length; i++){
    query.volume[start + i] *= linear_interpolation(0, 1, length - 1, 0, i);;
  }

  for(let i = length; i < f_length; i++){
    query.volume[start + i] = 0;
  }

  return query;
}

module.exports = class VoicevoxSong{
  #rpc;
  #version;
  #vml;

  constructor(host){
    this.#rpc = axios.create({baseURL: host, proxy: false});
    this.#vml = new VML(); // TODO: フレームレートを取得して入れる
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
      result = await this.#rpc.get('singers', {headers: { 'accept': 'application/json' }});
    }catch(e){
      throw e;
    }

    return result.data;
  }

  async query(score){
    let result;
    try{
      // クエリー用のスピーカーは使えるやつ限られてるのでとりま固定
      const query = await this.#rpc.post(`sing_frame_audio_query?speaker=6000`, JSON.stringify(score), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      result = (await query).data;
    }catch(e){
      throw e;
    }

    return result;
  }

  async sing(query, id){
    let result;
    try{
      const synth = await this.#rpc.post(`frame_synthesis?speaker=${id}`, JSON.stringify(query), {
        responseType: 'arraybuffer',
        headers: {
          Accept: 'audio/wav',
          "Content-Type": 'application/json'
        }
      });
      result = new Uint8Array(synth.data).buffer;
    }catch(e){
      throw e;
    }

    return result;
  }

  // text: score
  // filename: name
  // id: vocal_id
  async synthesis(text, filename, vocal_id){
    try{
      // Discordの仕様上歌詞部分に空白が入る場合があるので対策する
      text = text.split(';').map(x => x.trim()).join(';');

      let song;
      song = this.#vml.parse_voicevox(text, 0);
      for(let t of song.tracks){
        // 先頭の休符は元々指定されてるもの、4分のうち小さい方を採用する。
        // なおかつ0.12秒以下の場合には0.12秒にする。
        const first_length = Math.max(Math.min(t.distance, this.#vml.calc_frame(this.#vml.calc_ms('4', song.tempo))), this.#vml.calc_frame(120));

        t.notes.unshift({ key: null, frame_length: first_length, lyric: ''  });
        t.notes.push({ key: null, frame_length: this.#vml.calc_frame(500), lyric: '' });

        let q = await(this.query(t));

        t.query = fadeout(q, t.notes, this.#vml.calc_frame(150))
      }

      let last_note = song.tracks[song.tracks.length -1].notes;
      last_note = last_note[last_note.length -2];

      const channel = 2;
      const length = (last_note.ms_pos + last_note.ms + this.#vml.calc_ms('4', song.tempo)) * 0.001; // 最後のノートの位置+最後のノートの長さ+4分
      const sample = 48000;

      const off_ctx = new OfflineAudioContext(channel, sample * length, sample);

      for(let q of song.tracks){
        const synth_data = await this.sing(q.query, vocal_id);
        const synth_buf = await off_ctx.decodeAudioData(synth_data);

        const source = off_ctx.createBufferSource();
        source.buffer = synth_buf;
        source.connect(off_ctx.destination);
        source.start(Math.max((q.notes[1].ms_pos * 0.001) - (q.notes[0].frame_length / this.#vml.frame_rate), 0));
      }

      let buf = await off_ctx.startRendering();

      return buf;
    }catch(e){
      throw e;
    }
  }
}
