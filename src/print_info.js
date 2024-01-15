const os = require('os');

const {
  SERVER_DIR, TMP_DIR, VOICEVOX_ENGINE, REMOTE_REPLACE_HOST
} = require('../config.json');

const indent = "          ";
const fg_default = "\x1b[1;39m";
const fg_green = "\x1b[38:5:107m";
const fg_blue = "\x1b[38:5:159m";
const fg_white = "\x1b[38:5:15m";

const bg_default = "\x1b[1;49m";
const bg_white = "\x1b[1;47m";
const bg_red = "\x1b[48:5:208m";
const bg_green = "\x1b[48:5:106m";

const reset = fg_default + bg_default;

const ans = (flag, true_text, false_text) => {
  return flag ? `${bg_green}${fg_white} ${true_text} ${reset}`:`${bg_red}${fg_white} ${false_text} ${reset}`;
}

module.exports = (app) => {
    console.log(`\n`);

    console.log(`    ${bg_white}  ${fg_green}_  _ ____ _ ____ ____ _  _ ____ _  _    ___ ___ ____  ${reset}`);
    console.log(`    ${bg_white}  ${fg_green}|  | |  | | |    |___ |  | |  |  \\/      |   |  [__   ${reset}`);
    console.log(`    ${bg_white}  ${fg_green} \\/  |__| | |___ |___  \\/  |__| _/\\_     |   |  ___]  ${reset}`);
    console.log(`    ${bg_white}                                                        ${bg_default}`);
    console.log("");

    console.log(`${indent}${fg_blue}os:              ${fg_default}  ${os.type()} ${os.release()} ${os.arch()}`);
    console.log(`${indent}${fg_blue}node.js:         ${fg_default}  ${process.version}`);
    console.log(`${indent}${fg_blue}voicevox:        ${fg_default}  ${app.voicevox.version}`);

    console.log("");

    console.log(`${indent}${fg_blue}voicevox host:   ${fg_default}  ${VOICEVOX_ENGINE}`);
    console.log(`${indent}${fg_blue}temp directory:  ${fg_default}  ${TMP_DIR}`);
    console.log(`${indent}${fg_blue}data directory:  ${fg_default}  ${SERVER_DIR}`);

    console.log(`${indent}${fg_blue}pre opus convert:${fg_default}`);
    console.log(`${indent}${fg_blue}  enabled:       ${fg_default}  ${ans(app.config.opus_convert.enable, "yes", "no")}`);
    if(app.config.opus_convert.enable){
      console.log(`${indent}${fg_blue}  bitrate:       ${fg_default}  ${app.config.opus_convert.bitrate}`);
      console.log(`${indent}${fg_blue}  threads:       ${fg_default}  ${app.config.opus_convert.threads} core`);
    }
    console.log(`${indent}${fg_blue}replace host:    ${fg_default}  ${REMOTE_REPLACE_HOST}`);

    console.log("");

    console.log(`${indent}${fg_blue}production:      ${fg_default}  ${ans(!app.status.debug, 'yes', 'no')}`);
    console.log(`${indent}${fg_blue}server count:    ${fg_default}  ${app.status.connected_servers} servers`);
    console.log(`${indent}${fg_blue}voice count:     ${fg_default}  ${app.voice_list.length} voices`);
    console.log(`${indent}${fg_blue}pre opus convert:${fg_default}  ${ans(app.status.opus_convert_available, "available", "unavailable")}`);
    console.log(`${indent}${fg_blue}remote replace:  ${fg_default}  ${ans(app.status.remote_replace_available, "available", "unavailable")}`);
    console.log(`\n`);

    console.log(`${indent}Ready in as ${fg_green}${app.status.discord_username}${reset}!`);
}
