"use strict";

const { readFileSync } = require('fs');
const path = require('path');
const semver = require('semver');

function assertNodeVersion() {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  const requiredVersion = pkgJson.engines?.node;
  if (!requiredVersion) return;

  const currentVersion = process.version;
  if (!semver.satisfies(semver.clean(currentVersion), requiredVersion)) {
    console.error(
      `🚫 Error: Node.js ${requiredVersion}以上が必要です。\n　 現在のバージョン: ${currentVersion}`
    );
    process.exit(1);
  }
}

assertNodeVersion();

const App = require('./src/index.js');

function main(){
  const app = new App();
  module.exports = app;
  app.start();
}

main();
