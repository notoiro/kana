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
    if(buffer instanceof AudioBuffer){
      return buffer;
    }

    const context = new OfflineAudioContext(2, 44100, 44100);
    return await context.decodeAudioData(buffer);
  }

  // 音声の長さを判定
  classify_audio_length(buffer) {
    const duration = buffer.length / buffer.sampleRate;
    if (duration < 1.0) {
      return 'very_short'; // 1秒未満
    } else if (duration < 3.0) {
      return 'short'; // 3秒未満
    } else {
      return 'long'; // 3秒以上
    }
  }

  // 音声の種類を推定（簡易版）
  estimate_audio_type(buffer) {
    const duration = buffer.length / buffer.sampleRate;

    // 基本的な音響特性を分析
    let totalEnergy = 0;
    let peakCount = 0;
    const channels = buffer.numberOfChannels;

    for (let channel = 0; channel < channels; channel++) {
      const data = buffer.getChannelData(channel);

      // エネルギー計算
      for (let i = 0; i < data.length; i++) {
        totalEnergy += data[i] * data[i];
      }

      // ピーク検出（簡易版）
      for (let i = 1; i < data.length - 1; i++) {
        if (Math.abs(data[i]) > Math.abs(data[i-1]) &&
            Math.abs(data[i]) > Math.abs(data[i+1]) &&
            Math.abs(data[i]) > 0.1) {
          peakCount++;
        }
      }
    }

    const avgEnergy = totalEnergy / (buffer.length * channels);
    const peakDensity = peakCount / duration;

    // 簡易的な判定ロジック
    if (duration < 2.0 && avgEnergy > 0.01) {
      return 'speech'; // 短くてエネルギーが高い = 音声
    } else if (duration > 10.0 && peakDensity > 5) {
      return 'music'; // 長くてピークが多い = 音楽
    } else {
      return 'unknown';
    }
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

  // 短い音声用のラウドネス計算
  calculate_short_audio_loudness(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const duration = length / sampleRate;

    // 短い音声の場合は全体を一つのブロックとして処理
    let sumSquares = 0;
    let channelCount = 0;

    for (let channel = 0; channel < channels; channel++) {
      const channelData = buffer.getChannelData(channel);
      const filtered = this.applyKWeighting(channelData);

      const weight = channels > 1 ? 1.0 : 1.0;

      let blockSum = 0;
      for (let i = 0; i < filtered.length; i++) {
        blockSum += filtered[i] * filtered[i];
      }

      sumSquares += blockSum * weight;
      channelCount += weight;
    }

    const meanSquare = sumSquares / (length * channelCount);
    const loudness = -0.691 + 10 * Math.log10(meanSquare);

    // 短い音声の場合は補正係数を適用
    // 音声が短いほど実際よりも大きく測定される傾向があるため
    const durationFactor = Math.min(1.0, duration / 0.4); // 400ms基準
    const correctedLoudness = loudness + (1 - durationFactor) * 3; // 最大3dB補正

    this.logger.debug(`短い音声の補正: ${loudness.toFixed(2)} → ${correctedLoudness.toFixed(2)} LUFS`);
    this.logger.debug(`継続時間: ${duration.toFixed(3)}s, 補正係数: ${durationFactor.toFixed(3)}`);

    return correctedLoudness;
  }

  // 標準的な統合ラウドネス計算
  calculate_integrated_loudness(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const duration = length / sampleRate;

    // 短い音声の場合は特別な処理を使用
    if (duration < 1.0) {
      return this.calculate_short_audio_loudness(buffer);
    }

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

      if (loudness > -70) {
        blocks.push(loudness);
      }
    }

    if (blocks.length === 0) {
      return -70;
    }

    // 短い音声の場合はゲーティングを緩和
    if (duration < 3.0 && blocks.length < 5) {
      const meanLoudness = blocks.reduce((sum, l) => sum + Math.pow(10, l / 10), 0) / blocks.length;
      return -0.691 + 10 * Math.log10(meanLoudness);
    }

    // 標準的なゲーティング処理
    const meanLoudness = blocks.reduce((sum, l) => sum + Math.pow(10, l / 10), 0) / blocks.length;
    const relativeThreshold = -0.691 + 10 * Math.log10(meanLoudness) - 10;

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

  // 適応的なゲイン制限
  calculate_adaptive_gain_limit(buffer, audioType, lengthClass) {
    const duration = buffer.length / buffer.sampleRate;

    let maxGainDb = 12; // デフォルト最大ゲイン

    // 音声の種類による調整
    if (audioType === 'speech') {
      if (lengthClass === 'very_short') {
        maxGainDb = 6; // 非常に短い音声は6dBまで
      } else if (lengthClass === 'short') {
        maxGainDb = 9; // 短い音声は9dBまで
      }
    } else if (audioType === 'music') {
      maxGainDb = 15; // 音楽は少し大きめのゲインを許可
    }

    // 継続時間による微調整
    if (duration < 0.5) {
      maxGainDb = Math.min(maxGainDb, 4); // 0.5秒未満は4dBまで
    } else if (duration < 1.0) {
      maxGainDb = Math.min(maxGainDb, 8); // 1秒未満は8dBまで
    }

    return maxGainDb;
  }

  async normalize_loudness(audio_buffer, target_lufs, maxTruePeak = -1.0) {
    const current_lufs = this.calculate_integrated_loudness(audio_buffer);
    const current_peak = this.calculate_true_peak(audio_buffer);

    // 音声の特性を分析
    const lengthClass = this.classify_audio_length(audio_buffer);
    const audioType = this.estimate_audio_type(audio_buffer);

    // 適応的なゲイン制限を計算
    const maxGainDb = this.calculate_adaptive_gain_limit(audio_buffer, audioType, lengthClass);

    // Calculate required gain
    let gain = Math.pow(10, (target_lufs - current_lufs) / 20);
    let gainDb = 20 * Math.log10(gain);

    // 適応的なゲイン制限を適用
    if (gainDb > maxGainDb) {
      gainDb = maxGainDb;
      gain = Math.pow(10, gainDb / 20);
      this.logger.warn(`ゲインを${audioType}(${lengthClass})に適した値に制限: ${gainDb.toFixed(2)} dB`);
    }

    // Check if gain would cause clipping
    const predicted_peak = current_peak + gainDb;
    if (predicted_peak > maxTruePeak) {
      const max_gain_db = maxTruePeak - current_peak;
      if (max_gain_db < gainDb) {
        gainDb = max_gain_db;
        gain = Math.pow(10, gainDb / 20);
        this.logger.warn(`クリッピング防止のためゲインを制限: ${gainDb.toFixed(2)} dB`);
      }
    }

    this.logger.debug(`音声分析結果: ${audioType} (${lengthClass})`);
    this.logger.debug(`現在のラウドネス: ${current_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`現在のピーク: ${current_peak.toFixed(2)} dBTP`);
    this.logger.debug(`ターゲットラウドネス: ${target_lufs.toFixed(2)} LUFS`);
    this.logger.debug(`適用するゲイン: ${gainDb.toFixed(2)} dB (最大: ${maxGainDb} dB)`);

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
