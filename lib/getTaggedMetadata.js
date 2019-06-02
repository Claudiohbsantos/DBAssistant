module.exports = getTaggedMetadata

const path = require('path')
const mm = require('music-metadata')

const log = require(path.resolve(__dirname,'logger.js'))('getTaggedMetadata')

function getTaggedMetadata(fileBuffer,filePath) {
    log.info(`getting ${filePath} ID3, Exif, Vorbis metadata`)
    
    return new Promise((resolve,reject) => {
        mm.parseBuffer(fileBuffer, path.extname(filePath))
            .then(tags => {
                let metadata = {}
                metadata.description = tags.common.comment ? tags.common.comment.join(' ') : ''
                metadata.title = tags.common.title ? tags.common.title : ''
                metadata.artist = tags.common.artist ? tags.common.artist : ''
                metadata.album = tags.common.album ? tags.common.album : ''
                metadata.year = tags.common.date ? tags.common.date : ''
                metadata.genre = tags.common.genre ? tags.common.genre.join('-') : ''
                resolve(metadata)
            })
            .catch(err => {
                log.error(`failed to parse tagged metadata from ${filePath}`)
                reject(err)
            })
    })
}

