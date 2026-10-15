const path = require('node:path');
const dotenv = require('dotenv');

const envPath = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../../../.env');
const result = dotenv.config({ path: envPath });

if (result.error && result.error.code !== 'ENOENT') {
  throw result.error;
}

module.exports = { envPath };
