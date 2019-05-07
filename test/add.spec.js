const chai = require('chai')
chai.use(require('chai-subset'))
const expect = chai.expect
const path = require('path')

const add = require('../bin/add.js')
describe('Module Add', () => {
    describe('class File', function() {
        describe('constructor', function() {
            it('should return object with path property', function() {
                let input = 'anyString'
                let expected = {path: 'anyString'}
                let actual = new add.file(input)
                expect(actual.path).to.equal(expected.path)
            })
        })

        describe('isAudio()', function() {
            it('should be true for mp3,wav and aiff', function() {
                let input = path.join(__dirname,'testMedia','0026_dark slam 12.wav')
                let actual = new add.file(input).isAudio()
                expect(actual).to.be.true
            })
            it('should be true for MP3,WAV and AIFF', function() {
                let input = path.join(__dirname,'testMedia','0026_dark slam 12.WAV')
                let actual = new add.file(input).isAudio()
                expect(actual).to.be.true
            })
            it('should be false when not mp3, wav or aiff', function() {
                let input = path.join(__dirname,'testMedia','0026_dark slam 12.pdf')
                let actual = new add.file(input).isAudio()
                expect(actual).to.be.false
            })
            it('should be false when file does not exist', function() {
                let input = path.join(__dirname,'testMedia','notAFile.mp3')
                let actual = new add.file(input).isAudio()
                expect(actual).to.be.false
            })
        })

        describe('getStats()', function() {
            it('should get correct FileStats', function() {
                let input = path.join(__dirname,'testMedia','0026_dark slam 12.wav')
                let expected = {
                                file_size_low32 : 1728080,
                                file_size_hi32 : 0,
                                file_date_sec_since_1970 : 1545013322
                                } 
                let actual = new add.file(input)
                expect(actual).to.containSubset(expected)
            })
        })

        describe('dbEntry()', function() {
            it('should return string in correct format', function() {
                let input = path.join(__dirname,'testMedia','0026_dark slam 12.wav')
                let expected = `FILE "${input}" 1728080 0 1545013322`
                let actual = new add.file(input).dbEntry
                expect(actual).to.equal(expected)
            })
        })
    })

    describe('class reaperDB', function() {
        describe('dbEntry()', function() {
            it('should return DB entry string when passed just a file', function() {
                let inFile = new add.file(path.join(__dirname,'testMedia','0026_dark slam 12.wav'))
                let db = new add.reaperDB('notAPath')
                let actual = db.dbEntry(inFile)
                let expected = `FILE "${path.join(__dirname,'testMedia','0026_dark slam 12.wav')}" 1728080 0 1545013322`
                expect(actual).to.eql(expected)
            })
            it('should return DB entry string when passed a usertag', function() {
                let inFile = new add.file(path.join(__dirname,'testMedia','0026_dark slam 12.wav'))
                let db = new add.reaperDB('notAPath')
                let usertag = 'My Usertag'
                let actual = db.dbEntry(inFile,usertag)
                let expected = `FILE "${path.join(__dirname,'testMedia','0026_dark slam 12.wav')}" 1728080 0 1545013322\nDATA "u:My Usertag" `
                expect(actual).to.eql(expected)
            })
        })
    })
}); 
