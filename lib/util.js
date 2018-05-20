const
    R = require('ramda'),
    crypto = require('crypto');

module.exports = {
    sha256: (str)=> crypto.createHash('sha256').update(str, 'utf8').digest('hex'),
    toCamel: (str)=> str.split('_').map((word, index)=> R.pipe(R.toLower, index > 0 ? (word)=> word[0].toUpperCase() + word.slice(1) : R.identity)(word)).join('')
};
