#!/usr/bin/env node
let add = {}
module.exports = add

const fs = require('fs')
const fse = require('fs-extra')
const walk = require('walk')
const path = require('path')
const mediainfoExec =  require('mediainfo-parser').exec

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('add')

add.logInfo = {addedFiles:0}
//////////////////////////////////////////////////



add.main = function(input,config) {
	add.history = require(path.resolve(__dirname,'..','lib','history.js'))(input.user,config.databases,config.library)
	
	lib = new add.library(input.library)
	input.list.forEach(el => {
		add.addSource(el,input.user)
	})
}

add.exitRoutine = function() {
	add.history.createHeader(add.logInfo.addedFiles)
	add.history.write()
}
process.on('exit', add.exitRoutine );

///////////////////////////////////////////////////

let escapeRegExp = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

add.addSource = function(el,user) {
	log.update.clear()
	log.info(`Adding ${el.source} to ${el.dbs.length} databases`)
	log.verbose(`Adding ${el.source} to ${el.dbs}`)

	let cmdOrders = {
					source : el.source,
					subdir : el.subdir,
					dbs    : el.dbs,
					usertag: el.usertag,
					rename : el.rename,
					user   : user,
					lib    : lib
					}

	if (fs.lstatSync(el.source).isDirectory()) {
		walkPath(el.source,add.addFile,cmdOrders)
	} else if (fs.lstatSync(el.source).isFile()) {
		add.addFile(cmdOrders)
	}
}

function walkPath(inputPath,fileFunc,cmdOrders) {
	options = {
		followLinks: false, 
		filters: ["peaks"]
	};

	walker = walk.walk(inputPath,options)
	
	walker.on("file", function (root, fileStats, next) {
		let filePath = path.join(root,fileStats.name)
		let relativeDir = root.substring(path.parse(inputPath).dir.length+1)
		let newOrders = Object.assign({},cmdOrders)
		newOrders.source = filePath
		newOrders.subdir = path.join(newOrders.subdir,relativeDir)
		fileFunc(newOrders)
		next();
	});

	walker.on("errors", function (root, nodeStatsArray, next) {
		next();
	});

	walker.on("end", function () {
		// add.state = {walkFinished: true}
	});
}

function getDestPath(cmd) {
	let cleanSubdir =  new RegExp('^' + escapeRegExp(cmd.lib.path) + '(.+)','i')
	cmd.subdir = cmd.subdir.match(cleanSubdir) ?  cmd.subdir.match(cleanSubdir)[1] : cmd.subdir
	let nonEmpty = /[\w\d]/
	let folder = nonEmpty.test(cmd.subdir) ? cmd.subdir : cmd.user
	let base =  nonEmpty.test(cmd.rename) ? (cmd.rename + path.parse(cmd.source).ext) : path.parse(cmd.source).base
	let destPath = path.join(cmd.lib.path,folder, base)
	if (!nonEmpty.test(cmd.subdir)) {destPath = getUniquePath(destPath)} 
	return destPath
}

add.addFile = function(cmd) {
	let f = new add.file(cmd.source,() => {
		let destPath = getDestPath(cmd)
		cmd.lib.addFile(f,destPath)
		cmd.dbs.forEach(dbPath => {
			db = cmd.lib.getDB(dbPath)
			db.add(f,cmd.usertag)
		})

		add.history.log(f.path,cmd.dbs)
		add.logInfo.addedFiles++
		log.update(`${add.logInfo.addedFiles} files added to databases`)
	})
}

function getUniquePath(filePath) {
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

add.library = class {
	constructor(path) {
		this.path = path
		this.dbList = {}
	}

	addFile(file,destPath) {
		if (!this.isInLibrary(file)) {
			fse.copySync(file.path,destPath)
			file.path = destPath
		}
	}

	isInLibrary(file) {
		let isInLib = new RegExp('^' + escapeRegExp(this.path),'i')
		return isInLib.test(file.path)
	}

	getDB(dbPath) {
		if (!this.dbList[dbPath]) {
			this.dbList[dbPath] = new add.reaperDB(dbPath)
			this.dbList[dbPath].open()
		}
		return this.dbList[dbPath]
	}
}

add.reaperDB = class {
	constructor (path) {
		this.path = path
		this.stillWriting = 0
	}

	open() {  
		try{fs.accessSync(config.databases, fs.constants.W_OK)}
		catch(err) {
			log.error(`DBAssistant can't write to DB file: ${this.path}`)
			process.exit()
		}
		this.stream = fs.createWriteStream(this.path,{flags:'a'})
	}

	add(file,usertag) {
		if (this.stream) {this.stillWriting++ ; this.stream.write(this.dbEntry(file,usertag)+'\n',() => {this.stillWriting--})}
	}

	close() {
		if (this.stillWriting > 0) {
			setTimeout(() => {this.close()},1000)
		} else {
			if (this.stream) {this.stream.end()}
		}
	}

	dbEntry(file,usertag) {
		let entryString = `FILE "${file.path}" ${file.file_size_low32} ${file.file_size_hi32} ${file.file_date_sec_since_1970}`
		if (usertag || file.description) {
			entryString += "\nDATA " + (usertag ? `"u:${usertag}" ` : '') + (file.description ? `"d:${file.description}" ` : '')
		}
		return entryString
	}
}

add.file = class {
	constructor(path,callback) {
		this.path = path
		if (this.isAudio()) {
			this.getStats()
			this.getBWF(callback)
		}
	}

	get ext() {
		return path.parse(this.path).ext.toLowerCase()
	}

	isAudio() {
		if (!fs.existsSync(this.path)) {return false}
		return (this.ext == '.wav' || this.ext == '.aiff' || this.ext == '.mp3')
	}

	getStats() {
		let stat = fs.statSync(this.path)
		this.file_size_low32 = stat.size;
		this.file_size_hi32 = 0;
		this.file_date_sec_since_1970 = Math.floor(stat.mtimeMs / 1000)
	}

	getBWF(callback) {
		// TODO check whether mediainfo needs to be in PATH 
		mediainfoExec(this.path, (err, obj) => {
			if (obj.file && obj.file.track && obj.file.track[0].description) {
				this.description = obj.file.track[0].description
			}
			callback()
		  })
	}
}
