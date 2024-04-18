"use strict";

const App = require('./src/index.js');

function main(){
  const app = new App();
  module.exports = app;
  app.start();
}

main();
