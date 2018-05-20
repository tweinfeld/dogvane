const path = require('path');

module.exports = {
  "store": {
    "provider": {
        "type": "filesystem",
        "rootPath": path.join(__dirname, '.data')
    }
  },
    "web": {
        "port": 8080,
        "host": "http://localhost:8080"
    }
};