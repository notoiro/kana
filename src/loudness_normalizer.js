const { AudioContext } = require('node-web-audio-api');
const toWav = require('audiobuffer-to-wav');

class LoudnessNormalizer {
  constructor() {
    this.audio_context = new AudioContext();
  }

  async load_audio_file(buffer) {
    return await this.audio_context.decodeAudioData(buffer);
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

    const adjusted_buffer = this.audio_context.createBuffer(
      channels,
      length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel);
      const adjusted_data = adjusted_buffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        // クリッピングを防ぐために値を-1.0～1.0の範囲に制限
        adjusted_data[i] = Math.max(-1.0, Math.min(1.0, data[i] * gain));
      }
    }

    return adjusted_buffer;
  }

  normalize_loudness(audioBuffer, target_lufs) {
    const current_lufs = this.estimate_integrated_loudness(audioBuffer);

    const gain = target_lufs - current_lufs;

    const gain_factor = Math.pow(10, gain / 20);

    // console.log(`現在のラウドネス: ${current_lufs.toFixed(2)} LUFS`);
    // console.log(`ターゲットラウドネス: ${target_lufs.toFixed(2)} LUFS`);
    // console.log(`適用するゲイン: ${gain.toFixed(2)} dB (係数: ${gain_factor.toFixed(4)})`);

    return this.adjust_volume(audioBuffer, gain_factor);
  }

  async normalize_to_lufs(input_buffer, target_lufs) {
    try {
      const buffer = await this.load_audio_file(input_buffer);
      const normalized_buffer = this.normalize_loudness(buffer, target_lufs);

      return await this.export_buffer_to_wav(normalized_buffer);
    } catch (err) {
      console.error('バッチ正規化中にエラーが発生しました:', err);
      throw err;
    }
  }

  async export_buffer_to_wav(audioBuffer) {
    const wavData = toWav(audioBuffer);
    return Buffer.from(wavData);
  }
}

module.exports = LoudnessNormalizer;
