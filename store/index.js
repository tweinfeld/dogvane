const
    R = require('ramda'),
    kefir = require('kefir'),
    tar = require('tar-stream'),
    concat = require('concat-stream'),
    zlib = require('zlib'),
    jsYaml = require('js-yaml'),
    { PassThrough } = require('stream'),
    fileSystemProviderFactory = require('./provider/filesystem');

const PROVIDERS = {
    "filesystem": fileSystemProviderFactory
};

module.exports = function({ provider: { type: providerType = "filesystem", ...providerConfig } } = {}){

    let provider = PROVIDERS[providerType](providerConfig);

    return {
        push(chartArchiveStream, namespace = "default"){
            const
                directStream = chartArchiveStream.pipe(new PassThrough()),
                gzipStream = chartArchiveStream.pipe(zlib.createGunzip()),
                tarStream = gzipStream.pipe(tar.extract());

            return kefir
                .fromEvents(tarStream, 'entry', (header, stream, next)=> ({ header, stream, next }))
                .merge(kefir.merge([directStream, gzipStream, tarStream].map((stream)=> kefir.fromEvents(stream, 'error'))).take(1).flatMap(kefir.constantError))
                .flatMap(({ header, stream, next })=> {
                    return kefir
                        .fromCallback((cb)=> stream.pipe(concat(cb)))
                        .map((contents)=> Object.assign(header, { contents }))
                        .onEnd(next);
                })
                .filter(R.pipe(R.prop('name'), R.test(/^[^/]*\/Chart.yaml$/)))
                .map(R.pipe(R.prop('contents'), R.toString, jsYaml.safeLoad))
                .take(1)
                .takeErrors(1)
                .flatMap((metadata)=> kefir.fromPromise(provider.put(metadata, directStream, namespace)))
                .toPromise();
        },
        fetch(name, version, namespace = "default"){
            return provider.get({ name, version }, namespace);
        },
        list(namespace = "default"){
            return provider
                .list(namespace)
                .scan((ac, metadata)=> {
                    let { name } = metadata;
                    (ac[name] = ac[name] || []).push(metadata); // Direct array mutation (on purpose)
                    return ac;
                }, {})
                .toPromise();
        }
    }
};