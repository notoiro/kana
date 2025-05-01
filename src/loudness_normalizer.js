const { OfflineAudioContext } = require('node-web-audio-api');
const toWav = require('audiobuffer-to-wav');
const log4js = require('log4js');

class LoudnessNormalizer {
  constructor() {
    this.logger = log4js.getLogger('normalizer');
    this.logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';
  }

  async load_audio_file(buffer) {
    const context = new OfflineAudioContext(2, 44100, 44100);
    return await context.decodeAudioData(buffer);
  }

  calc_rms_loudness(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    let squares = 0;
    let count = 0;

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        squares += data[i] * data[i];
        count++;
      }
    }
    return Math.sqrt(squares / count);
  }

  estimate_integrated_loudness(buffer) {
    const rms = this.calc_rms_loudness(buffer);
    const db_rms = 20 * Math.log10(rms);
    return db_rms - 10;
  }

  adjust_volume(buffer, gain) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;

    const off_ctx = new OfflineAudioContext(channels, length, buffer.sampleRate);

    const buf_source = off_ctx.createBufferSource();
    buf_source.buffer = buffer;

    const gainNode = off_ctx.createGain();
    gainNode.gain.value = gain;

    buf_source.connect(gainNode);
    gainNode.connect(off_ctx.destination);

    buf_source.start(0);

    return off_ctx.startRendering();
  }

  normalize_loudness(audio_buffer, target_lufs) {
    const current_lufs = this.estimate_integrated_loudness(audio_buffer);
    const gain = Math.pow(10, (target_lufs - current_lufs) / 20);

    this.logger.debug(`現在のラウドネス: ${current_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`ターゲットラウドネス: ${target_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`適用するゲイン: ${(20 * Math.log10(gain)).toFixed(2)} dB (係数: ${gain.toFixed(4)})`);

    return this.adjust_volume(audio_buffer, gain);
  }

  async normalize_to_lufs(input_buffer, target_lufs) {
    try {
      const buffer = await this.load_audio_file(input_buffer);
      const normalized_buffer = await this.normalize_loudness(buffer, target_lufs);

      return this.export_buffer_to_wav(normalized_buffer);
    } catch (err) {
      this.logger.error('normalizer err', err);
      throw err;
    }
  }

  export_buffer_to_wav(audioBuffer) {
    const wavData = toWav(audioBuffer);
    return Buffer.from(wavData);
  }
}

module.exports = LoudnessNormalizer;
