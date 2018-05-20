const
    R = require('ramda'),
    kefir = require('kefir'),
    S3 = require('aws-sdk/clients/s3'),
    { sha256 } = require('../../lib/util');

const
    toBucketName = (namespace)=> sha256(namespace).substr(0, 20),
    toObjectName = ({ name, version })=> [[name, version].join('-'), "tgz"].join('.');

module.exports = function({
      accessKeyId,
      secretAccessKey
} = {}){
    let s3 = new S3({ accessKeyId, secretAccessKey }); //logger: console,
    return {
        put(metadata, archiveStream, namespace) {
            let bucketName = toBucketName(namespace);

            return kefir
                .fromNodeCallback((cb)=> s3.createBucket({ "Bucket": bucketName }, cb))
                .flatMap(()=> {
                    return kefir.fromNodeCallback((cb)=> s3.upload({
                        "Bucket": bucketName,
                        "Key": toObjectName(metadata),
                        "Body": archiveStream,
                         "Metadata": { "chart": JSON.stringify(metadata) }
                    }, cb))
                })
                .toPromise();
        },
        get(metadata, namespace){
            return s3.getObject({ "Bucket": toBucketName(namespace), "Key": toObjectName(metadata) }).createReadStream();
        },
        list(namespace){
            let bucketName = toBucketName(namespace);
            return kefir
                .fromNodeCallback((cb)=> s3.listObjects({ "Bucket": bucketName }, cb))
                .map(R.pipe(R.prop('Contents'), R.map(R.prop('Key'))))
                .flatten()
                .flatMap((keyName)=>
                    kefir
                        .fromNodeCallback((cb)=> s3.headObject({ "Bucket": bucketName, "Key": keyName }, cb))
                        .map(R.pipe(R.path(["Metadata", "chart"]), JSON.parse))
                );
        }
    }
};