'use strict';

require('dotenv').load();

const url = require('url');
const connect = require('connect');
const morgan = require('morgan');
const LRUCache = require('lru-native');
const {Client} = require('minio');

const app = connect();
const client = new Client({
  endpoint: process.env.BLOB_ENDPOINT,
  port: process.env.BLOB_PORT,
  accessKey: process.env.BLOB_ACCESS_KEY,
  secretKey: process.env.BLOB_SECRET_KEY
});
const cache = new LRUCache({
  maxElements: 1000,
  maxAge: 300 * 1000
});

const pathCheckRegexp = /\.\w+$/;

app.use(morgan(':method :req[host] :url :status :response-time ms - :res[content-length]'));

app.use((req, resp, next) => {
  let path = url.parse(req.url).pathname;
  if (!pathCheckRegexp.test(path)) {
    path += path.endsWith('/') ? 'index.html' : '/index.html';
  }
  req.requestUri = `${req.headers['host']}${path}`;
  console.log(req.requestUri);
  next();
});

app.use((req, resp, next) => {
  const uri = req.requestUri;
  const content = cache.get(uri);
  if (content) {
    resp.end(content);
  } else {
    next();
  }
});

app.use((req, resp) => {
  client.getObject(process.env.BLOB_BUCKET, req.requestUri, (err, stream) => {
    if (err) {
      resp.status(404);
      resp.end();
    } else {
      const buffers = [];
      stream.pipe(resp);
      stream.on('data', data => buffers.push(data));
      stream.on('emd', () => {
        const buffer = Buffer.concat(buffers);
        cache.set(req.requestUri, buffer);
      });
    }
  });
});
