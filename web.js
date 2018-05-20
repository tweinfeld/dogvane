const
    R = require('ramda'),
    jsYaml = require('js-yaml'),
    express = require('express'),
    { EventEmitter } = require('events');

const
    DEFAULT_CHART_SIZE_LIMIT = 1024 * 500,  // 500Kb
    DEFAULT_CALLBACK_TIMEOUT = 1000 * 5,    // 5 Seconds
    MANIFEST_VERSION = "v1",
    DEFAULT_HOST = "http://localhost:8080",
    DEFAULT_CHART_FETCH_BASE_PATH_TEMPLATE = "${namespace}/${filename}.tgz";

const
    timeoutCallback = (callback, timeout = DEFAULT_CALLBACK_TIMEOUT)=> {
        let callbackOnce = R.once(callback);
        setTimeout(R.partial(callbackOnce, [new Error(`Timed-out after ${DEFAULT_CALLBACK_TIMEOUT}ms`)]), DEFAULT_CALLBACK_TIMEOUT);
        return callbackOnce;
    },
    templateFactory = (templateText)=> (obj)=> templateText.replace(/\${([a-z]+)}/g, (_, key)=> obj[key] || "");

module.exports = class extends EventEmitter {
    constructor({
            port = 8080,
            chart_size_limit = DEFAULT_CHART_SIZE_LIMIT } = {},
            host = DEFAULT_HOST
    ){
        super();

        const resourceTemplate = templateFactory([host, DEFAULT_CHART_FETCH_BASE_PATH_TEMPLATE].join('/'));

        const app = express();
        app.param('namespace', (req, res, next)=> next(!/^[a-z]{1,10}$/.test(req.params["namespace"]) && new Error('Invalid namespace')));
        app.post('/:namespace/',
            (req, res, next)=> next(R.pipe(R.pathOr("0", ["headers", "content-length"]), Number)(req) > chart_size_limit && new Error(`Chart size cannot exceed ${chart_size_limit} bytes`)),
            (req, res, next)=> {
                this.emit('chart:submit', {
                    namespace: req.params["namespace"],
                    chart: req,
                    callback: timeoutCallback(function(err){
                        err ? next(err) : res.json({ status: "OK" });
                    })
                });
            }
        );

        app.get('/:namespace/:filename.tgz', (req, res, next)=> {
            let [, chart, version] = R.match(/^([^-]+)-(.+)$/, req.params["filename"]);
            this.emit('chart:fetch', {
                namespace: req.params["namespace"],
                chart,
                version,
                callback: timeoutCallback((err, stream)=> {
                    stream.pipe(res);
                    stream.once('error', next);
                })
            });
        });

        app.get('/:namespace/index.yaml', (req, res, next)=> {
            let namespace = req.params["namespace"];
            this.emit('chart:list', {
                namespace,
                callback: timeoutCallback(function(err, manifest){
                    err
                        ? next(err)
                        : R.pipe(
                            R.map(R.pipe(R.sortBy(R.prop('version')), R.reverse, R.map((obj)=> Object.assign(obj, { urls: [resourceTemplate({ namespace, filename: R.props(["name", "version"], obj).join('-') })] })))),
                            (entries)=> jsYaml.safeDump({ "apiVersion": MANIFEST_VERSION, entries, "generated": new Date() }),
                            (yaml)=> res.contentType('text/yaml').send(yaml)
                        )(manifest)
                })
            });
        });

        app.listen(port);
    }
};