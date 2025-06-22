const { OfflineAudioContext } = require('node-web-audio-api');
const toWav = require('audiobuffer-to-wav');
const log4js = require('log4js');

class LoudnessNormalizer {
  constructor() {
    this.logger = log4js.getLogger('normalizer');
    this.logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';

    // K-weighting filter coefficients (simplified)
    this.preFilter = {
      b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
      a: [1.0, -1.69065929318241, 0.73248077421585]
    };

    this.rlbFilter = {
      b: [1.0, -2.0, 1.0],
      a: [1.0, -1.99004745483398, 0.99007225036621]
    };
  }

  async load_audio_file(buffer) {
    const context = new OfflineAudioContext(2, 44100, 44100);
    return await context.decodeAudioData(buffer);
  }

  // K-weightingフィルタの適用（簡易版）
  applyKWeighting(channelData) {
    const filtered = new Float32Array(channelData.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let x1_rlb = 0, x2_rlb = 0, y1_rlb = 0, y2_rlb = 0;

    for (let i = 0; i < channelData.length; i++) {
      // Pre-filter (high shelf)
      const y = this.preFilter.b[0] * channelData[i] +
                this.preFilter.b[1] * x1 +
                this.preFilter.b[2] * x2 -
                this.preFilter.a[1] * y1 -
                this.preFilter.a[2] * y2;

      x2 = x1;
      x1 = channelData[i];
      y2 = y1;
      y1 = y;

      // RLB filter (high pass)
      const y_rlb = this.rlbFilter.b[0] * y +
                    this.rlbFilter.b[1] * x1_rlb +
                    this.rlbFilter.b[2] * x2_rlb -
                    this.rlbFilter.a[1] * y1_rlb -
                    this.rlbFilter.a[2] * y2_rlb;

      x2_rlb = x1_rlb;
      x1_rlb = y;
      y2_rlb = y1_rlb;
      y1_rlb = y_rlb;

      filtered[i] = y_rlb;
    }

    return filtered;
  }

  // より正確な統合ラウドネス計算
  calculate_integrated_loudness(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;

    // 400ms blocks for gating
    const blockSize = Math.floor(sampleRate * 0.4);
    const overlapSize = Math.floor(blockSize * 0.75); // 75% overlap
    const stepSize = blockSize - overlapSize;

    const blocks = [];

    for (let start = 0; start < length - blockSize; start += stepSize) {
      let sumSquares = 0;
      let channelCount = 0;

      for (let channel = 0; channel < channels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const filtered = this.applyKWeighting(channelData.slice(start, start + blockSize));

        // Channel weighting (mono/stereo)
        const weight = channels > 1 ? 1.0 : 1.0;

        let blockSum = 0;
        for (let i = 0; i < filtered.length; i++) {
          blockSum += filtered[i] * filtered[i];
        }

        sumSquares += blockSum * weight;
        channelCount += weight;
      }

      const meanSquare = sumSquares / (blockSize * channelCount);
      const loudness = -0.691 + 10 * Math.log10(meanSquare);

      if (loudness > -70) { // Absolute threshold
        blocks.push(loudness);
      }
    }

    if (blocks.length === 0) {
      return -70; // Silence
    }

    // Relative threshold (10 LU below mean)
    const meanLoudness = blocks.reduce((sum, l) => sum + Math.pow(10, l / 10), 0) / blocks.length;
    const relativeThreshold = -0.691 + 10 * Math.log10(meanLoudness) - 10;

    // Final calculation with relative gating
    const gatedBlocks = blocks.filter(l => l > relativeThreshold);

    if (gatedBlocks.length === 0) {
      return -70;
    }

    const finalMean = gatedBlocks.reduce((sum, l) => sum + Math.pow(10, l / 10), 0) / gatedBlocks.length;
    return -0.691 + 10 * Math.log10(finalMean);
  }

  // True Peak detection (simplified)
  calculate_true_peak(buffer) {
    let maxPeak = 0;
    const channels = buffer.numberOfChannels;

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel);

      // 4x oversampling simulation (simplified)
      for (let i = 0; i < data.length - 1; i++) {
        const sample1 = Math.abs(data[i]);
        const sample2 = Math.abs(data[i + 1]);

        // Linear interpolation for oversampling
        const interpolated1 = Math.abs((3 * data[i] + data[i + 1]) / 4);
        const interpolated2 = Math.abs((data[i] + data[i + 1]) / 2);
        const interpolated3 = Math.abs((data[i] + 3 * data[i + 1]) / 4);

        maxPeak = Math.max(maxPeak, sample1, sample2, interpolated1, interpolated2, interpolated3);
      }
    }

    return 20 * Math.log10(maxPeak);
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

  // リミッター機能付きボリューム調整
  async adjust_volume_with_limiting(buffer, gain, maxTruePeak = -1.0) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;

    const off_ctx = new OfflineAudioContext(channels, length, sampleRate);

    const buf_source = off_ctx.createBufferSource();
    buf_source.buffer = buffer;

    const gainNode = off_ctx.createGain();
    gainNode.gain.value = gain;

    // Simple limiter using DynamicsCompressor
    const limiter = off_ctx.createDynamicsCompressor();
    limiter.threshold.value = maxTruePeak;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.01;

    buf_source.connect(gainNode);
    gainNode.connect(limiter);
    limiter.connect(off_ctx.destination);

    buf_source.start(0);

    return off_ctx.startRendering();
  }

  async normalize_loudness(audio_buffer, target_lufs, maxTruePeak = -1.0) {
    const current_lufs = this.calculate_integrated_loudness(audio_buffer);
    const current_peak = this.calculate_true_peak(audio_buffer);

    // Calculate required gain
    let gain = Math.pow(10, (target_lufs - current_lufs) / 20);

    // Check if gain would cause clipping
    const predicted_peak = current_peak + 20 * Math.log10(gain);
    if (predicted_peak > maxTruePeak) {
      // Reduce gain to prevent clipping
      const max_gain = Math.pow(10, (maxTruePeak - current_peak) / 20);
      gain = Math.min(gain, max_gain);

      this.logger.warn(`ゲインを制限しました: ${(20 * Math.log10(gain)).toFixed(2)} dB`);
      this.logger.warn(`予想されるピーク: ${predicted_peak.toFixed(2)} dBTP`);
    }

    this.logger.debug(`現在のラウドネス: ${current_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`現在のピーク: ${current_peak.toFixed(2)} dBTP`);
    this.logger.debug(`ターゲットラウドネス: ${target_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`適用するゲイン: ${(20 * Math.log10(gain)).toFixed(2)} dB`);

    return this.adjust_volume_with_limiting(audio_buffer, gain, maxTruePeak);
  }

  async normalize_to_lufs(input_buffer, target_lufs = -23.0, maxTruePeak = -1.0) {
    try {
      const buffer = await this.load_audio_file(input_buffer);
      const normalized_buffer = await this.normalize_loudness(buffer, target_lufs, maxTruePeak);

      // Verify the result
      const final_lufs = this.calculate_integrated_loudness(normalized_buffer);
      const final_peak = this.calculate_true_peak(normalized_buffer);

      this.logger.debug(`正規化完了:`);
      this.logger.debug(`  最終ラウドネス: ${final_lufs.toFixed(2)} LUFS`);
      this.logger.debug(`  最終ピーク: ${final_peak.toFixed(2)} dBTP`);
      this.logger.debug(`  ターゲットとの差: ${(final_lufs - target_lufs).toFixed(2)} LU`);

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
