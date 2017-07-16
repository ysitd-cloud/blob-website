'use strict';

require('dotenv').load();

const url = require('url');
const connect = require('connect');
const morgan = require('morgan');
const LRUCache = require('lru-native');
const {Client} = require('minio');

const app = connect();
const client = new Client({
  endPoint: process.env.BLOB_ENDPOINT,
  port: parseInt(process.env.BLOB_PORT, 10),
  accessKey: process.env.BLOB_ACCESS_KEY,
  secretKey: process.env.BLOB_SECRET_KEY,
  secure: false
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
  const host = req.headers.host.replace(/:\d+/, '');
  req.requestUri = `${host}${path}`;
  console.log(`Request: ${req.requestUri}`);
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
      resp.writeHead(404);
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

app.listen(process.env.PORT, '127.1.1.1');
