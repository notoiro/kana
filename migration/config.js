const fs = require('fs');
const sample = require('../sample.json');

function main(){
  const p = process.argv[2];
  if(!p) process.exit(1);

  migration(p);
}

function migration(f_path){
  const lists = Object.keys(sample);

  let json;
  try{
    json = JSON.parse(fs.readFileSync(f_path));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);

    return;
  }

  let new_json = {};

  for(let l of lists){
    if(json[l] === "VOICEBOX_ENGINE"){
      new_json["VOICEVOX_ENGINE"] = json[l];
      continue;
    }
    if(json[l] === undefined){
      new_json[l] = sample[l];
      continue;
    }

    new_json[l] = json[l];
  }

  try{
    fs.writeFileSync(f_path + '.new', JSON.stringify(new_json, undefined, " "));
  }catch(e){
    console.error(`failed to migration(${f_path}):`)
    console.error(e);
  }
}

main();
