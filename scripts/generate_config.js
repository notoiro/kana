#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const JSON5 = require('json5');
const SCHEMA_PATH = path.join(__dirname, '../resources/config.schema.json5');

const loadJSON5 = (filePath) => {
  try{
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON5.parse(raw);
  }catch (err){
    console.error(err);
  }
};

const schema_raw = loadJSON5(SCHEMA_PATH)

// モード判定
const args = process.argv.slice(2);
const mode = args.includes('--min') ? 'min' : 'full';

const emit_comment = (desc, indent) => {
  if(!desc) return [];
  if(Array.isArray(desc)){
    return desc.map(line => `${indent}// ${line}`);
  }
  return [];
};

const generate_sample_config = (schema, mode = 'full') => {
  const indent = '  ';
  const lines = ['{'];

  for(const [key, def] of Object.entries(schema)){
    if(key.startsWith('_')) continue;

    if(mode === 'min' && def.required !== true) continue;

    const desc = def.description;
    const side_comment = typeof desc === 'string' ? `// ${desc}` : '';

    const exampleValue =
      typeof def.example === 'object'
        ? def.example?.[mode]
        : def.example !== undefined
        ? def.example
        : def.default !== undefined
        ? def.default
        : def.type === 'string'
        ? 'example'
        : def.type === 'number'
        ? 123
        : def.type === 'boolean'
        ? true
        : def.type === 'array'
        ? []
        : def.type === 'object'
        ? {}
        : null;

    const json5Value = JSON5.stringify(exampleValue, { space: 2, quote: '"' }).replace(/\n/g, `\n${indent}`);
    // 上にコメント（複数行）
    if(Array.isArray(desc)){
      lines.push(...emit_comment(desc, indent));
      lines.push(`${indent}${key}: ${json5Value},`);
    }else{
      // 横にコメント（1行説明）
      lines.push(`${indent}${key}: ${json5Value}, ${side_comment}`);
    }
  }

  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  }

  lines.push('}');
  return lines.join('\n');
};


// サンプル生成
const sample = generate_sample_config(schema_raw, mode);

// 出力
console.log(sample);
