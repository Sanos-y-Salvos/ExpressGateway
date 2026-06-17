const path = require('path');
const gateway = require('express-gateway');

// Le decimos explícitamente dónde está la carpeta config
process.env.EG_CONFIG_DIR = path.join(__dirname, 'config');

gateway()
  .load(path.join(__dirname, 'config'))
  .run();