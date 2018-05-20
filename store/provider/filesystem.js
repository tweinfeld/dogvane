const
    R = require('ramda'),
    path = require('path'),
    kefir = require('kefir'),
    cacache = require('cacache'),
    { sha256 } = require('../../lib/util');

module.exports = function({ rootPath = path.join(__dirname, '.data') } = {}){

    const getBasePath = R.pipe(sha256, R.partial(path.join, [rootPath]));

    return {
        put(metadata, archiveStream, namespace){
            let cacacheStream = archiveStream
                .pipe(cacache.put.stream(getBasePath(namespace), R.props(["name", "version"], metadata).join('-'), { metadata }));

            return kefir
                .fromEvents(cacacheStream, 'finish')
                .merge(kefir.fromEvents(cacacheStream, 'error').flatMap(kefir.constantError))
                .take(1)
                .takeErrors(1)
                .toPromise();
        },
        get(metadata, namespace){
            return cacache.get.stream(getBasePath(namespace), R.props(["name", "version"], metadata).join('-'));
        },
        list(namespace){
            let listStream = cacache.ls.stream(getBasePath(namespace));
            return kefir
                .fromEvents(listStream, 'data')
                .takeUntilBy(kefir.fromEvents(listStream, 'end'))
                .map(R.prop('metadata'));
        }
    };
};