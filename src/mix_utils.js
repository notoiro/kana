const { OfflineAudioContext } = require('node-web-audio-api');
const Utils = require('./utils.js');

module.exports = class MixUtils{
  constructor(){

  }

  static async mix(sounds){
    const channel = 2;
    let length = 0;
    const sample = 48000;

    for(let s of sounds){
      if(length < s.buffer.length) length = s.buffer.length;
    }

    const off_ctx = new OfflineAudioContext(channel, length, sample);

    for(let s of sounds){
      const source = off_ctx.createBufferSource();
      source.buffer = s.buffer;

      const gain = off_ctx.createGain();
      gain.gain.value = Utils.map_voice_setting(s.gain, 0, 1, 0, 100);

      source.connect(gain);
      gain.connect(off_ctx.destination);

      source.start();
    }

    let buf = await off_ctx.startRendering();

    return buf;
  }
}
