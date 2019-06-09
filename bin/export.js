module.exports = x = {}

const fs = require('fs')
const path = require('path')
const stream = require('stream')
const byline = require('byline')
const EOL = require('os').EOL;

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('export')

var nDBExported = 0
var dbTotal
x.main = function (input) {
    dbTotal = input.dbList.length
    log.info(`remapping ${input.currentLib} to ${input.newLib}`)
    let dbmjson = []
    input.dbList.forEach((db) => {
        let newRef = x.copyDBReplacingLib(db.ref,input.currentLib,input.newLib,input.destination)
        let shortcutName = db.name ? db.name : path.parse(db.ref).name
        dbmjson.push({ name:shortcutName,ref:newRef})
    })
    log.update.done()
    x.writeDBMJson(dbmjson,input.destination)  
    log.info('Shortcuts file (.dbmjson) written to destination.')
}

x.copyDBReplacingLib = function(ref,curLib,newLib,dest) {
    let db = fs.createReadStream(ref)
    db = byline.createStream(db,{ encoding: 'utf8' })

    let rewrite = createRewriteTransformStream(curLib,newLib)

    let destPath = getExportedDBPath(ref,dest)
    let newDB = fs.createWriteStream(destPath)
    newDB.on('finish', function(){nDBExported++;log.update(`exported ${nDBExported}/${dbTotal} DBs`)})


    db.pipe(rewrite).pipe(newDB)

    return destPath
}

x.writeDBMJson = function(dbmjson,dest) {
    fs.writeFileSync(path.join(dest,'exportedDBs.dbmjson'),JSON.stringify(dbmjson))
}

let getExportedDBPath = function(ref,dest) {
    let destDir = path.join(dest,'DBs')
    if (!fs.existsSync(destDir)){
        fs.mkdirSync(destDir);
    }
    return path.join(destDir,path.parse(ref).base)
}

let createRewriteTransformStream = function(curLib,newLib) {
    let rewrite = new stream.Transform({objectMode:true})

    rewrite._transform = function(line,encoding,done) {
        let r = new RegExp('^(FILE ")(' + escapeRegExp(curLib) + ')','i')
        let newLine = line.replace(r,'$1' + newLib) + EOL
        this.push(newLine)
        done()
    }
    
    return rewrite
}

let escapeRegExp = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
  