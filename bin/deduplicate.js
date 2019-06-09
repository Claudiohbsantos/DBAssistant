module.exports = main

const fs = require('fs')
const path = require('path')

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('deduplicate')

function main(dbs) {
	if (!dbs) {
		log.error('missing deduplicate dbs list')
		process.exit(1)
	}
	dbs.forEach(db => {
		let parsedDB = parseFilesEliminatingDuplicates(db)
		rewriteDB(db,parsedDB)
	})
}

function rewriteDB(filePath,parsedDB) {
	let fd = fs.openSync(filePath, 'w')
	fs.writeSync(fd,parsedDB.headerPaths)
	log.info(`Rewriting ${filePath}`)
	let count = 0
	for (var entry in parsedDB.entries) {
		fs.writeSync(fd,parsedDB.entries[entry].file + '\n' + (parsedDB.entries[entry].data ? parsedDB.entries[entry].data + '\n' : ''))
		count++
		log.update(`${count}/${parsedDB.nEntries} entries rewriten`)
	}
	log.update.done()
	fs.closeSync(fd)
}

function parseFilesEliminatingDuplicates(filePath) {
	let dbInfo = {headerPaths:'',entries:{},nEntries:0,duplicates:0}
	let currentEntry
	log.info(`Parsing ${filePath}`)
	forEachLine(filePath,line => {
		let typeOfLine = line.match(/^\w+/)
		if (typeOfLine) {
			switch(typeOfLine[0]) {
				case 'FILE':
					let regex = /^FILE "([^"]+)"/;
					let fPath = line.match(regex)[1]
					if (dbInfo.entries[fPath]) {dbInfo.duplicates++} else {dbInfo.nEntries++}
					dbInfo.entries[fPath] = {file:line}
					currentEntry = dbInfo.entries[fPath]
					break;
				case 'DATA':
					currentEntry.data = line
					break;
				case 'PATH':
					dbInfo.headerPaths = dbInfo.headerPaths + line + '\n'
					break;
			}
		}
		log.update(`${dbInfo.nEntries} unique entries read | ${dbInfo.duplicates} duplicates found`)
	})
	log.update.done()
	return dbInfo
}

function forEachLine(filePath,func) {
	let fd = fs.openSync(filePath, 'r');
	let bufferSize = 1024;
	let buffer = new Buffer.alloc(bufferSize)

	var leftOver = '';
	var read, line, idxStart, idx;
	while ((read = fs.readSync(fd, buffer, 0, bufferSize, null)) !== 0) {
	  leftOver += buffer.toString('utf8', 0, read);
	  idxStart = 0
	  while ((idx = leftOver.indexOf("\n", idxStart)) !== -1) {
	    line = leftOver.substring(idxStart, idx);
	    func(line)
	    idxStart = idx + 1;
	  }
	  leftOver = leftOver.substring(idxStart);
	}
	func(leftOver)
	fs.closeSync(fd)
}