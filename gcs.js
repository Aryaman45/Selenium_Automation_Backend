const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage({
  keyFilename: path.join(__dirname, 'service-account.json'),
  projectId: 'arched-vigil-461018-b2',
});

const bucket = storage.bucket('reports-csv-automation');

module.exports = { bucket };