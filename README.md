# dogvane
A tiny, nimble Helm charts repository with support for multiple stores

## Installation
To install Dogvane, run

```bash
npm install dogvane --save
```

## Running

```bash
npm start
```

Dogvane will automatically start and listen to incoming HTTP requests on http://localhost:8080

## Usage

### Fetch index.yaml
To get fetch `index.yaml` of the `default` namespace:
```curl http://localhost:8080/default/index.yaml```

### Post New Chart
Post a `.tgz` file to `http://localhost:8080/[namespace]`

### Get a Chart
Use the proper `URL` off `index.yaml`

## Configuration

Configuration can be established in two ways:

1. Modifying `config.js`
2. Passing variable strings prefixed with `DOGVANE.`

### Sample Configuration File

Here's a general sample of `config.js`

```js
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
```

### Web Server

You can customize the HTTP server used to host the Helm chart protocol by modifying the `web` section in config.js:

  * **port** - The local port to listen on
  * **host** - The base host on which the server is hosted. It will be used to create the links in the manifest (`index.yaml`) file.
  
### Storage Providers

Dogvane supports multiple storage providers

#### S3

To configure S3, add the following block `config.js`:

```json
"store": {
    "provider": {
        "type": "s3",
        "accessKeyId" : "...[AWS Access Key]...", 
        "secretAccessKey": "...[AWS Secret Access Key]..."        
    }
  }
```

#### Local Filesystem

To host the repo files on your local filesystem, add the following block to `config.js`:

```json
 "store": {
    "provider": {
        "type": "filesystem",
        "rootPath": "...[Filesystem Path]..."
    }
  }
```



