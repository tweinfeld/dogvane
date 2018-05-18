const
    R = require('ramda'),
    path = require('path'),
    storeFactory = require('./store/index'),
    WebView = require('./web');

let store = storeFactory({
    provider: {
        type: "filesystem",
        rootPath: path.join(__dirname, '.data')
    }
});

let web = new WebView({
    port: 8080,
    host: "http://localhost:8080"
});

web.on('chart:submit', ({ namespace, callback, chart })=> store.push(chart, namespace).then(R.partial(callback, [null]), callback));
web.on('chart:list', ({ namespace, callback })=> store.list(namespace).then(R.partial(callback, [null]), callback));
web.on('chart:fetch', ({ namespace, chart, version, callback })=> callback(null, store.fetch(chart, version, namespace)));