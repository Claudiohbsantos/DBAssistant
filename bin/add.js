#!/usr/bin/env node

module.exports = main

const fs = require('fs')
const fse = require('fs-extra')
const walk = require('walk')
const path = require('path')

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('add')
let logInfo = {addedFiles:0}
let onGoingWalkers = 0
let history
//////////////////////////////////////////////////

function main(input,config) {
	history = require(path.resolve(__dirname,'..','lib','history.js'))(input.user,config.databases,config.library)
	lib = new library(input.library)
	input.list.forEach(el => {
		addSource(el,input.user)
	})
	history.createHeader(logInfo.addedFiles)
	history.write()
}

// /////////////////////////////////////////////////

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function addSource(el,user) {
	log.update.clear()
	log.info(`Adding ${el.source} to ${el.dbs.length} databases`)
	log.verbose(`Adding ${el.source} to ${el.dbs}`)
	if (fs.lstatSync(el.source).isDirectory()) {
		walkPath(el.source,el.subdir,el.dbs,onGoingWalkers)
	} else if (fs.lstatSync(el.source).isFile()) {
		let destFolder 
		if (el.subdir && el.subdir !== '') {
			destFolder = el.subdir
			var dontOverwrite = false
		} else {
			destFolder = user
			var dontOverwrite = true
		}
		addFile(el.source,destFolder,el.dbs,dontOverwrite)
	}
}

function addFile(fPath,destFolder,dbs,dontOverwrite) {
	let f = new file(fPath)
	if (f.isAudio()) {
		lib.addFile(f,destFolder,dontOverwrite)
		dbs.forEach(dbPath => {
			db = lib.getDB(dbPath)
			db.add(f)
		})
		history.log(f.path,dbs)
		logInfo.addedFiles++
		log.update(`${logInfo.addedFiles} files added to databases`)
	}
}

function walkPath(inputPath,subdir,dbs,onGoingWalkers) {
	// onGoingWalkers++
	options = {
		followLinks: false, 
		filters: ["peaks"]
	};

	walker = walk.walk(inputPath,options)
	
	walker.on("file", function (root, fileStats, next) {
		let relativeDir = root.substring(path.parse(inputPath).dir.length+1)
		let filePath = path.join(root,fileStats.name)
		let destFolder =  path.join(subdir,relativeDir)
		addFile(filePath,destFolder,dbs)
		next();
	});

	walker.on("errors", function (root, nodeStatsArray, next) {
		next();
	});

	walker.on("end", function () {
		// onGoingWalkers[0]--
	});
}

 

// /////////////////////////////////////////////////

class library {
	constructor(path) {
		this.path = path
		this.dbList = {}
	}

	addFile(file,destFolder,dontOverwrite) {
		if (!this.isInLibrary(file)) {
			let newPath = path.join(this.path,destFolder,path.parse(file.path).base)
			newPath = (dontOverwrite ? this.getUniquePath(newPath) : newPath)
			fse.copySync(file.path,newPath)
			file.path = newPath
		}
	}

	isInLibrary(file) {
		let isInLib = new RegExp('^'+escapeRegExp(this.path),'i')
		return isInLib.test(file.path)
	}

	getUniquePath(filePath) {
		let pathObj = path.parse(filePath)
		let suffix = 0
		function tryNewName(newName) {
			if (fs.existsSync(newName)) {
				suffix++
				return tryNewName(path.join(pathObj.dir,pathObj.name+'_'+suffix+pathObj.ext))
			} else {
				return newName
			}
		}
		return tryNewName(path.format(pathObj))
	}

	getDB(dbPath) {
		if (!this.dbList[dbPath]) {
			this.dbList[dbPath] = new reaperDB(dbPath)
			this.dbList[dbPath].open()
		}
		return this.dbList[dbPath]
	}
}

class reaperDB {
	constructor (path) {
		this.path = path
		this.stillWriting = 0
	}

	open() {  
		// TODO verify writable
		this.stream = fs.createWriteStream(this.path,{flags:'a'})
	}

	add(file) {
		if (this.stream) {this.stillWriting++ ; this.stream.write(file.dbEntry+'\n',() => {this.stillWriting--})}
	}

	close() {
		if (this.stillWriting > 0) {
			setTimeout(() => {this.close()},1000)
		} else {
			if (this.stream) {this.stream.end()}
		}
	}
}

class file {
	constructor(path) {
		this.path = path
		if (this.isAudio()) {this.getStats()}
	}

	get ext() {
		return path.parse(this.path).ext.toLowerCase()
	}

	isAudio() {
		return (this.ext == '.wav' || this.ext == '.aiff' || this.ext == '.mp3')
	}

	getStats() {
		let stat = fs.statSync(this.path)
		this.file_size_low32 = stat.size;
		this.file_size_hi32 = 0;
		this.file_date_sec_since_1970 = Math.floor(stat.mtimeMs / 1000)
	}

	get dbEntry() {
		let entryString = `FILE "${this.path}" ${this.file_size_low32} ${this.file_size_hi32} ${this.file_date_sec_since_1970}`
		if (this.usertag || this.description) {
			entryString += "\nDATA " + (this.usertag ? `"u:${this.usertag}" ` : '') + (this.description ? `"d:${this.description}" ` : '')
		}
		return entryString
	}
}
