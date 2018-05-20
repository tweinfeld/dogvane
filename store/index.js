const
    R = require('ramda'),
    kefir = require('kefir'),
    tar = require('tar-stream'),
    concat = require('concat-stream'),
    zlib = require('zlib'),
    jsYaml = require('js-yaml'),
    { PassThrough } = require('stream'),
    fileSystemProviderFactory = require('./provider/filesystem'),
    s3ProviderFactory = require('./provider/s3');

const
    SWEEP_BUFFER_SIZE = 5 * 1024 * 1024,
    PROVIDERS = {
        "filesystem": fileSystemProviderFactory,
        "s3": s3ProviderFactory
    };

module.exports = function({ provider: { type: providerType = "filesystem", ...providerConfig } } = {}){

    let provider = PROVIDERS[providerType](providerConfig);

    return {
        push(chartArchiveStream, namespace = "default"){

            const
                directStream = chartArchiveStream.pipe(new PassThrough({ highWaterMark: SWEEP_BUFFER_SIZE })),
                gzipStream = chartArchiveStream.pipe(zlib.createGunzip()),
                tarStream = gzipStream.pipe(tar.extract());

            gzipStream.on('error', ()=> {}); // <-- Prevents irrelevant uncaught exception once kefir stream finds what is needs and ends

            return kefir
                .fromEvents(tarStream, 'entry', (header, stream, next)=> ({ header, stream, next }))
                .merge(kefir.merge([gzipStream, tarStream, directStream].map((stream)=> kefir.fromEvents(stream, 'error'))).flatMap(kefir.constantError))
                .takeUntilBy(kefir.fromEvents(tarStream, 'end').take(1))
                .flatMap(({ header, stream, next })=> {
                    return kefir
                        .fromCallback((cb)=> stream.pipe(concat(cb)))
                        .map((contents)=> Object.assign(header, { contents }))
                        .onEnd(next);
                })
                .filter(R.pipe(R.prop('name'), R.test(/^[^/]*\/Chart.yaml$/)))
                .map(R.pipe(R.prop('contents'), R.toString, jsYaml.safeLoad))
                .beforeEnd(()=> new Error('Failed to locate chart manifest'))
                .take(1)
                .flatMap((data)=> data instanceof Error ? kefir.constantError(data) : kefir.constant(data))
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