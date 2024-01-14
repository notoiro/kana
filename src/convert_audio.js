const ffmpeg = require('fluent-ffmpeg');

module.exports = (path, output_path, bitrate = '96k', threads = '2') =>{
  return new Promise((resolve, reject) => {
      const options = [
        '-vn', '-ar', '24000', '-ac', '1', '-acodec', 'libopus', '-vbr', 'on', // no video, 24000 Hz, mono, opus codec, 可変bitrate
        '-ab', bitrate, // Bitrate
        '-threads', threads, // encode threads
        '-y', // Overwrite
        '-hide_banner', '-nostats', '-loglevel', 'warning' // optimize
      ];

      console.log(options)

      ffmpeg()
        .input(path)
        .outputOptions(options)
        .saveToFile(output_path)
        .on('end', () => { resolve(output_path) })
        .on('error', (err) => { reject(e) });
  });
}
