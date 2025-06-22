const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');
const log4js = require('log4js');

const CONFIG_PATH = path.join(__dirname, '../config.json5');
const SCHEMA_PATH = path.join(__dirname, '../resources/config.schema.json5');

logger = log4js.getLogger('config_loader');
logger.level = !(process.env.NODE_ENV === "production") ? 'debug' : 'info';

const fg_default = "\x1b[1;39m";
const fg_yellow = "\x1b[1;38;5;228m";
const fg_gray = "\x1b[1;38;5;244m";

const critical = (e) => {
  logger.error(e);
  process.exit(1);
}

const is_directory = (value) => {
  try{
    return fs.existsSync(value) && fs.statSync(value).isDirectory();
  }catch{
    return false;
  }
};

const loadJSON5 = (filePath) => {
  try{
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON5.parse(raw);
  }catch (err){
    critical(`${fg_yellow}${filePath}${fg_default}の読み込みまたはパースに失敗しました: \n  ${err.message}`);
  }
};

const validate_and_apply_defaults = (config, schema) => {
  const result = { ...config };

  const validate_value = (key, value, rule, path = key) => {
    // デフォルト値処理
    if(value === undefined && 'default' in rule) value = rule.default;
    // 必須処理
    if(rule.required && (value === undefined || value === null)) critical(`config error: ${fg_yellow}${path}${fg_default}は必須です`);

    if(value !== undefined && rule.type){
      const actualType =
        Array.isArray(value) ? 'array' : (typeof value === 'object' && value !== null) ? 'object' : typeof value;

      if(rule.type === 'directory'){
        if(typeof value !== 'string' || !is_directory(value)){
          logger.info(`config warning: ${fg_yellow}${path}${fg_default}はディレクトリであることが期待されますが、「${fg_yellow}${value}${fg_default}」はディレクトリではありません！`);
        }
      }else if(actualType !== rule.type){
        critical(`config error: ${fg_yellow}${path}${fg_default}は${fg_yellow}${rule.type}${fg_default}型である必要があります（実際: ${fg_yellow}${actualType}${fg_default}）`);
      }

      if(rule.disallow && Array.isArray(rule.disallow)){
        if(rule.disallow.includes(value)){
          critical(`config error: ${fg_yellow}${path}${fg_default}の値「${fg_yellow}${value}${fg_default}」は許可されていない文字列です`);
        }
      }

      if (rule.non_empty && value === '') {
        critical(`config error: ${fg_yellow}${path}${fg_default}は空文字であってはいけません`);
      }

      // must_be_urlはURLまたはnoneであることを期待する
      if(rule.must_be_url && typeof value === 'string'){
        try{
          new URL(value); // ここ正規表現でもいいかも
        }catch{
          if(value !== "none") logger.info(`config warning: ${fg_yellow}${path}${fg_default}の値「${fg_yellow}${value}${fg_default}」は有効なURL形式ではありません`);
        }
      }

      if(rule.type === 'array' && rule.items && Array.isArray(value)){
        const field_maps = {};

        for(let i = 0; i < value.length; i++){
          const validated = validate_value(`${key}[${i}]`, value[i], rule.items, `${path}[${i}]`);

          if(rule.items.type === 'object' && rule.items.properties){
            for(const [field, def] of Object.entries(rule.items.properties)){
              if(def.unique){
                const field_value = validated[field];
                if(!field_maps[field])field_maps[field] = new Map();
                if(field_maps[field].has(field_value)){
                  const dupIndex = field_maps[field].get(field_value);
                  critical(`config error: ${fg_yellow}${path}[${i}].${field}${fg_default}の値「${fg_yellow}${field_value}${fg_default}」は${fg_yellow}${path}[${dupIndex}].${field}${fg_default}と重複しています`);
                }
                field_maps[field].set(field_value, i);
              }
            }
          }

          value[i] = validated;
        }

        return value;
      }

      if(rule.type === 'object' && rule.properties && typeof value === 'object'){
        const validated_object = { ...value };
        for (const propKey in rule.properties) {
          validated_object[propKey] = validate_value(propKey, value[propKey], rule.properties[propKey], `${path}.${propKey}`);
        }
        return validated_object;
      }
    }

    return value;
  };

  for(const key of Object.keys(schema)){
    result[key] = validate_value(key, config[key], schema[key], key);
  }

  return result;
};

const check_deprecated_params = (config, schema) => {
  const deprecated = schema.deprecated;
  if(!Array.isArray(deprecated)) return;

  for(const entry of deprecated){
    if(typeof entry === 'string'){
      if(entry in config){
        logger.info(`⚠️ パラメーター「${fg_yellow}${entry}${fg_default}」は廃止されました`);
      }
    }else if(typeof entry === 'object' && entry.key){
      if(entry.key in config){
        const message = entry.reason
          ? `⚠️ パラメーター「${fg_yellow}${entry.key}${fg_default}」は廃止されました：${fg_gray}${entry.reason}${fg_default}`
          : `⚠️ パラメーター「${fg_yellow}${entry.key}${fg_default}」は廃止されました`;
        logger.info(message);
      }
    }
  }
};

// 実行部
const config_raw = loadJSON5(CONFIG_PATH);
const schema_raw = loadJSON5(SCHEMA_PATH);

const meta = schema_raw._meta || {};
const schema_defs = Object.fromEntries(Object.entries(schema_raw).filter(([k]) => k !== '_meta'));

const validated_config = validate_and_apply_defaults(config_raw, schema_defs);

// エクスポート
module.exports = {
  check_deprecated: () => {
    return check_deprecated_params(config_raw, meta);
  },
  CONFIG: validated_config,
  ...validated_config
};


