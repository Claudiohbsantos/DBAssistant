#!/usr/bin/env node
let add = {}
module.exports = add

const fs = require('fs')
const fse = require('fs-extra')
const walk = require('walk')
const path = require('path')

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('add')

const getWavMetadata = require(path.resolve(__dirname,'..','lib','getWavMetadata.js'))
const getTaggedMetadata = require(path.resolve(__dirname,'..','lib','getTaggedMetadata.js'))

add.logInfo = {addedFiles:0}
let renamed = 0
//////////////////////////////////////////////////

add.quick = function(input) {
	log.info('DBAssistant: (quick) Adding files to Databases')
	log.info(`Database: ${input.db}`)
	add.history = require(path.resolve(__dirname,'..','lib','history.js'))('cli',__dirname)

	input.sources.forEach(source => {
		let f = new add.file(source,() => {
			let db = new add.reaperDB(input.db)
			db.open()
			db.add(f,input.usertag,'')
		})

		add.history.log(f.path,[input.db])	
		log.info(`added ${source}`)
		add.logInfo.addedFiles++
	})
	log.info(`${add.logInfo.addedFiles} files added to database`)
}

add.complete = function(input) {
	log.info('DBAssistant: Adding files to Databases')
	add.history = require(path.resolve(__dirname,'..','lib','history.js'))(input.user,input.library)
	
	lib = new add.library(input.library)
	input.list.forEach(el => {
		add.addSource(el,input.user,input.shouldCopyToLib)
	})
}

add.exitRoutine = function() {
	log.update.done()
	if (add.history && add.logInfo.addedFiles > 0) {
		add.history.createHeader(add.logInfo.addedFiles)
		add.history.write()
		log.info(`history file added to ${add.history.filePath}`)
	}
	log.info(`DBAssistant is exiting`)
}
process.on('exit', add.exitRoutine );

///////////////////////////////////////////////////

let escapeRegExp = function(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

add.addSource = function(el,user,shouldCopyToLib) {
	log.update.clear()

	if (!fs.existsSync(el.source)) {
		log.error(`${el.source} doesn't seem to exist`)
	} else {
		log.info(`Adding ${el.source} to ${el.dbs.length} databases`)
		log.verbose(`Adding ${el.source} to ${el.dbs}`)

		let cmdOrders = {
						source         : el.source,
						subdir         : el.subdir,
						dbs            : el.dbs,
						usertag        : el.usertag,
						rename         : el.rename,
						user           : user,
						lib            : lib,
						shouldCopyToLib: shouldCopyToLib
						}

		if (fs.lstatSync(el.source).isDirectory()) {
			cmdOrders.rename = ''
			walkPath(el.source,add.addFile,cmdOrders)
		} else if (fs.lstatSync(el.source).isFile()) {
			add.addFile(cmdOrders)
		}
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

	let base
	if (nonEmpty.test(cmd.rename)) {
		base = cmd.rename + (renamed > 0 ? `_${renamed}` : '') + path.parse(cmd.source).ext 
		renamed++ 
	} else {
		base = path.parse(cmd.source).base
	}
	
	let destPath
	if (path.parse(cmd.subdir).root) {
		destPath = path.join(folder, base)
	} else {
		destPath = path.join(cmd.lib.path,folder, base)
	}

	if (!nonEmpty.test(cmd.subdir)) {destPath = getUniquePath(destPath)} 
	
	return destPath
}

add.addFile = function(cmd) {
	let f = new add.file(cmd.source,() => {
		let destPath = getDestPath(cmd)
		cmd.lib.addFile(f,destPath,cmd.shouldCopyToLib)
		cmd.dbs.forEach(dbPath => {
			db = cmd.lib.getDB(dbPath)
			db.add(f,cmd.usertag,cmd.user)
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

	addFile(file,destPath,shouldCopyToLib) {
		if (!this.isInLibrary(file) && shouldCopyToLib) {
			log.verbose(`Copying ${file.path} to ${destPath}`)
			// TODO Make async
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
		if (!fs.existsSync(this.path)) {
			log.warn(`Database doesn't exist. Creating ${this.path}`)
		}
		this.stream = fs.createWriteStream(this.path,{flags:'a'})
	}

	add(file,usertag,user) {
		if (this.stream) {
			log.verbose(`adding ${file.path} to ${this.path}`)
			log.verbose(`${this.dbEntry(file,usertag,user)}`)
			this.stillWriting++
			this.stream.write(this.dbEntry(file,usertag,user)+'\n',() => {this.stillWriting--})
		}
	}

	close() {
		if (this.stillWriting > 0) {
			setTimeout(() => {this.close()},1000)
		} else {
			if (this.stream) {this.stream.end()}
		}
	}

	dbEntry(file,usertag,user) {
		let entryString = [`FILE "${file.path}" ${file.file_size_low32} ${file.file_size_hi32} ${file.file_date_sec_since_1970}`]
			entryString.push("\nDATA")
			entryString.push(` "u:${usertag}"`)
			entryString.push(` "t:${file.title}"`)
			entryString.push(` "d:${file.description}"`)
			entryString.push(` "a:${file.artist}"`)
			entryString.push(` "b:${file.album}"`)
			entryString.push(` "y:${file.year}"`)
			entryString.push(` "g:${file.genre}"`)
			entryString.push(` "c:${user}"`)
		return entryString.join('')
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
		let validExtensions = ['.wav','.aiff','.aif','.mp3','.ogg','.wv','.flac']
		return validExtensions.includes(this.ext)
	}

	getStats() {
		log.verbose(`getting ${this.path} stats`)
		let stat = fs.statSync(this.path)
		this.file_size_low32 = stat.size;
		this.file_size_hi32 = 0;
		this.file_date_sec_since_1970 = Math.floor(stat.mtimeMs / 1000)
	}

	getBWF(callback) {
		fs.readFile(this.path,(err,buff) => {
			if (err) {log.error(`failed to read ${this.path} for metadata extraction`); return}
			let wavMeta
			if (/\.wav/i.test(this.path)) {wavMeta = getWavMetadata(buff,this.path)}
		
			let tagMeta = getTaggedMetadata(buff,this.path)
		
			Promise.all([wavMeta,tagMeta])
				.then(values => {
					let metadata = Object.assign({},values[1],values[0])
					Object.assign(this,metadata)
					callback()
				})
				.catch(err => {
					log.error(`failed to parse metadata from ${this.path}`)
				})
		})
	}
}
