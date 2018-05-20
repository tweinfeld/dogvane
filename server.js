const
    R = require('ramda'),
    path = require('path'),
    storeFactory = require('./store/index'),
    WebView = require('./web'),
    defaultConfig = require('./config.js'),
    { toCamel } = require('./lib/util');

const config = Object.assign(
    defaultConfig,
    Object
        .keys(process.env)
        .filter((key)=> key.startsWith('DOGVANE.'))
        .reduce((ac, keyName)=> R.assocPath(keyName.split('.').slice(1).map(toCamel), process.env[keyName], ac), {}),
);

const
    store = storeFactory(config["store"]),
    web = new WebView(config["web"]);

web.on('chart:submit', ({ namespace, callback, chart })=> store.push(chart, namespace).then(R.partial(callback, [null]), callback));
web.on('chart:list', ({ namespace, callback })=> store.list(namespace).then(R.partial(callback, [null]), callback));
web.on('chart:fetch', ({ namespace, chart, version, callback })=> callback(null, store.fetch(chart, version, namespace)));