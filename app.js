const express = require('express');
const http = require('http');
const socket = require('socket.io');
const swaggerTools = require('swagger-tools');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const connectMongo = require('connect-mongo');

const fdebug = require('./lib/fdebug');
const common = require('./lib/common');
const Redis = require('./lib/redis');
const Movies = require('./lib/movies');

const debug = fdebug('movies:app');

function app(config) {
  debug('init....');
  const self = this;
  this.main = {
    config,
    db: common.getDB(),
    restEndpoint: config.get('service.protocol') + config.get('service.host') + config.get('service.pathname'),
    sockets: {},
    app: express(),
  };

  return new Promise((resolve, reject) => {
    this.swaggerDoc()
      .then(self.getApp())
      .then(self.io())
      .then(self.redisClient())
      .then(self.announce())
      .then(self.libs())
      .then(self.controllers())
      .then(self.routers())
      .then(() => resolve(this.main))
      .catch((err) => reject(err));
  });
}

app.prototype.swaggerDoc = async function swaggerDoc() {
  console.info('running swaggerDoc');

  try {
    const swaggerFile = path.join(__dirname, '/api/swagger/swagger.yaml');
    const swaggerString = fs.readFileSync(swaggerFile, 'utf8');
    const swaggerDocObject = yaml.safeLoad(swaggerString);

    swaggerDocObject.host = this.main.config.get('service.host');
    swaggerDocObject.basePath = this.main.config.get('service.pathname');

    this.main.swaggerDoc = swaggerDocObject;
    return { swaggerDoc: swaggerDocObject };
  } catch (err) {
    throw new Error('Error into swaggerDoc');
  }
};

app.prototype.getApp = async function getApp() {
  console.info('getApp...');

  try {
    this.main.app.set('trust proxy', 1);

    this.main.app.use(session({
      secret: 'mysecretData',
      store: connectMongo.create({ mongoUrl: this.main.config.get('db') }),
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true },
    }));

    this.main.server = http.createServer(this.main.app);
    return {
      app: this.main.app,
      server: this.main.server,
    };
  } catch (err) {
    console.error(err);
    throw new Error('Error into getApp');
  }
};

app.prototype.io = async function io() {
  console.info('io...');
  try {
    const pathName = this.main.config.get('service.pathname');
    debug(`${pathName}/socket.io`);
    this.main.io = socket(this.main.server);

    this.main.io.on('connection', (sock) => {
      debug(`Socket.io connected: ${sock.id}`);
      this.main.sockets[sock.id] = sock;
      this.main.sockets[sock.created] = new Date();

      socket.on('disconnect', () => {
        delete this.main.sockets[sock.id];
      });
    });
    return {
      io: this.main.io,
    };
  } catch (err) {
    console.error(err);
    throw new Error('Erro into io');
  }
};

app.prototype.redisClient = async function redisClient() {
  console.info('redisClient');

  try {
    this.main.redisClient = new Redis();
    return {
      redisClient: this.main.redisClient,
    };
  } catch (err) {
    throw new Error('Error into redisClient');
  }
};

app.prototype.announce = async function announce() {
  console.info('announce...');

  try {
    this.main.announce = function _announce(...args) {
      const params = Array.prototype.slice.apply(args);
      this.main.io.sockets.emit.apply(this.main.io.sockets, params);
    };

    return {
      announce: this.main.announce,
    };
  } catch (err) {
    throw new Error('Error into announce');
  }
};

app.prototype.libs = async function libs() {
  try {
    this.main.libs = {};
    this.main.libs.http = http;
    this.main.libs.Movies = new Movies(this.main);
    return this.main.libs;
  } catch (err) {
    throw new Error('Error into libs');
  }
};

app.prototype.controllers = async function controllers() {
  try {
    this.main.controllers = require('./controllers')(this.main);
    return this.main.controllers;
  } catch (err) {
    throw new Error('Error into controllers');
  }
};

app.prototype.routers = async function routers() {
  console.info('routers...');

  const self = this;
  const options = {
    controllers: this.main.controllers,
  };

  const formatValidationError = function formatValidationError(req, res, next, err) {
    console.info('cb: ', err);
    res.json({ error: true });
    /*
    const error = {
      code: 'validation_error',
      message: err.message,
      details: err.results ? err.results.errors : null,
    };
    */
  };

  function initMiddleWare(middleware, callback) {
    debug('initializating middleware');

    self.main.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', true);

      if (req.method === 'OPTIONS') return res.end();

      return next();
    });

    self.main.app.use(middleware.swaggerMetadata());
    self.main.app.use(middleware.swaggerValidator(), formatValidationError);

    self.main.app.use(middleware.swaggerRouter(options));

    self.main.app.use((req, res, next, err) => {
      res.status(500);
      res.send(err);
      res.end();
    });

    self.main.app.use(middleware.swaggerUi({
      apiDocs: `${self.main.config.get('service.pathname')}/api-docs`,
      swaggerUi: `${self.main.config.get('service.pathname')}/docs`,
    }));

    self.main.app.use(express.static('public'));
    callback();
  }

  try {
    self.main.app.use(cors());
    self.main.app.set('basePath', this.main.swaggerDoc.basePath);
    swaggerTools.initializeMiddleware(this.main.swaggerDoc, (swaggerMiddleware) => {
      initMiddleWare(swaggerMiddleware, () => {});
    });
  } catch (err) {
    console.info(err);
    throw new Error('Error into routers');
  }
};

module.exports = app;
