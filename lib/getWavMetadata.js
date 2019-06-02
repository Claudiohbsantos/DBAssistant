module.exports = getWavMetadata

const path = require('path')
const wavefile = require('wavefile')
const fs = require('fs')
const readChunk = require('read-chunk')
const xml2js = require('xml2js').parseString

const log = require(path.resolve(__dirname,'logger.js'))('getWavMetadata')

let Wav = class {
    constructor(fPath) {
        this.path = fPath
    }

    getMetadata() {
        return new Promise((resolve,reject) => {
            fs.readFile(this.path,(err,file) => {
                if (err) return reject(`failed to read ${this.path} during metadata extraction`)

                this.wavefile = new wavefile(file)
                this.getIXML(this.wavefile)
                .catch(err => {
                    log.error(`failed to get ${this.path} ixml`)
                    reject(err)
                })
                .then(ixml => {this.ixml = ixml})
                .then(() => {
                    const metadata = {}
                    metadata.description = removeNull(this.getDescription())
                    metadata.title = removeNull(this.getTitle())
                    metadata.artist = removeNull(this.getArtist())
                    metadata.album = removeNull(this.getAlbum())
                    metadata.year = removeNull(this.getYear())
                    metadata.genre = removeNull(this.getGenre())
                    resolve(metadata)
                })
            })
        })
    }

    getDescription() {
        try {return this.wavefile.bext.description} catch (e) {}
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'ICMT').value} catch (e) {}
        try {return this.ixml.BWFXML.BEXT.BWF_DESCRIPTION} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaComment').VALUE} catch (e) {}
        return ''
    }

    getTitle() {
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'INAM').value} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaTrackTitle').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'SmfSongName').VALUE} catch (e) {}
        return ''
    }
    getArtist() {
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'IART').value} catch (e) {}
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'IENG').value} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaArtist').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'AudioSoundEditor').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'AudioActor').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'AudioSoundMixer').VALUE} catch (e) {}
        return ''
    }

    getAlbum() {
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaAlbum').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'AudioCDName').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.PROJECT} catch (e) {}
        return ''
    }

    getGenre() { 
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'IGNR').value} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaGenre').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MediaCategoryPost').VALUE} catch (e) {}
        try {return this.ixml.BWFXML.STEINBERG.ATTR_LIST.ATTR.find(atr => atr.NAME == 'MusicalCategory').VALUE} catch (e) {}
        return ''
    }

    getYear() {
        try {return this.wavefile.LIST.find(el => el.chunkId == 'LIST').subChunks.find(chunk => chunk.chunkId == 'ICRD').value} catch (e) {}
        try {return this.wavefile.bext.originationDate} catch (e) {}
        try {return this.ixml.BWFXML.BEXT.BWF_ORIGINATION_DATE} catch (e) {}
        return ''
    }

    getIXML() {
        return new Promise((resolve,reject) => {
            let chunkInfo
            try {chunkInfo = this.wavefile.signature.subChunks.find(chunk => chunk.chunkId == 'iXML')}
            catch(e) {return resolve({})}
            if (!chunkInfo) return resolve({})

            readChunk(this.path,chunkInfo.chunkData.start,chunkInfo.chunkSize)
                .then(buf => {
                    let xml = buf.toString()
                    xml2js(xml,{explicitArray:false, trim:true}, (err,obj) => {
                        if (err) return reject(err)
                        resolve(obj)
                    })
                })
                .catch(err => reject(err))
        })
    }
}

function getWavMetadata(fPath) {
    log.info(`getting ${fPath} metadata`)
    
    return new Promise((resolve,reject) => {
        const wav = new Wav(fPath)
        wav.getMetadata()
            .then(metadata => resolve(metadata))
            .catch(err => reject(err))
    })
}

function removeNull(str) {
    let nullChars = /\0/g
    return str.replace(nullChars,'')
}

