"use strict";

const App = require('./src/index.js');

function main(){
  const app = new App();
  app.start();

  module.exports = app;
}

main();
