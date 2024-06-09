import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}},
  {languageOptions: { globals: globals.node }},
  pluginJs.configs.recommended,
  {
    rules: {
      "no-irregular-whitespace": "off",
      "no-useless-escape": "off",
      "no-extra-boolean-cast": "off",
      "no-useless-catch": "off",
      "no-prototype-builtins": "off",
      "no-unused-vars": "warn",
      "no-constant-binary-expression": "warn",

    }
  }
];
