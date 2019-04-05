#!/usr/bin/env node

module.exports = main

const fs = require('fs')
const fse = require('fs-extra')
const walk = require('walk')
const path = require('path')
const log = require(path.resolve(__dirname,'..','lib','logger.js'))('add')

const TIMEOUT = 45028
const POOLCLOSED = 45027
const DUPLICATED = 1062

//
function defer() {
	var res, rej;

	var promise = new Promise((resolve, reject) => {
		res = resolve;
		rej = reject;
	});

	promise.resolve = res;
	promise.reject = rej;

	return promise;
}

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

const todayDate = (function () {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; //January is 0!
	var yyyy = today.getFullYear();

	return yyyy + '-' + mm + '-' + dd
})()

let ensureFileIsInLib = (function() {
	let options = {overwrite:false,
			preserveTimestamps:true
			}

	function getUniquePath(filePath) {
		let suffix = 0
		function tryNewName(newName) {
			if (fs.existsSync(newName)) {
				suffix++
				return tryNewName(path.join(filePath.dir,filePath.name+'_'+suffix+filePath.ext))
			} else {
				return newName
			}
		}
		return tryNewName(path.format(filePath))
	}

	function copyFile(src,dest,skipOnDup) {
		return new Promise((resolve,reject) => {
			let destPath = path.parse(src)
			delete destPath.base
			destPath.dir = dest
			let uniqueName = skipOnDup ? path.format(destPath) : getUniquePath(destPath)
			fse.copy(src,uniqueName,options,(err) => {
				if (err) reject(err)
				resolve(uniqueName)	
			})
		})	
	}

	function createDestinationPath(lib,relativeDir,user,destDir) {
		if (destDir) {return path.join(lib,destDir,(relativeDir || ''))}
		if (relativeDir) {return path.join(lib,relativeDir)}
		return path.join(lib,user)
	}


	function copyIfNecessary(filePath,lib,user,relativeDir) {
		return new Promise((resolve,reject) => {

			let isInLib = new RegExp('^'+escapeRegExp(lib),'i')
			if (!isInLib.test(filePath)) {	
				let skipOnDup = (!!relativeDir || !!prg.directory)
				copyFile(filePath,createDestinationPath(lib,relativeDir,user,prg.directory),skipOnDup).then((newPath) => {resolve(newPath)}).catch(err => {reject(err)})		
			} else {
				resolve(filePath)
			}
			
		})
	}

	return copyIfNecessary
})()

class reaperDB {
	constructor(winPath,macPath,mode) {
		this.mode = mode
		this.winDBPath = winPath.path
		this.macDBPath = macPath.path
		this.stillWriting = 0
	}

	requestConnectionToShare() {
		if (!requestConnectionToShare.alreadyRun) {
			requestConnectionToShare.alreadyRun = true
		}
		log.error('Unable to access SilverPi Share.')
		log.warn('Please follow the below procedures and try again:\n- Open "\\\\silverpi\\SilverPi" on the explorer/finder window\n- Login with username:pi password:auratone and check "remember my credentials" box\n- Try running this command again after you see the share on explorer/finder')
	}

	verifyFilesAreWritable() {
		return new Promise((resolve,reject) => {
			try {
				fs.accessSync(this.winDBPath, fs.constants.W_OK)
				fs.accessSync(this.macDBPath, fs.constants.W_OK)
				this.winStream = fs.createWriteStream(this.winDBPath, {flags:this.mode})		
				this.macStream = fs.createWriteStream(this.macDBPath, {flags:this.mode})
				resolve()
			}
			catch(err) {
				this.requestConnectionToShare()
				reject(err)
			}
			
		})
	}

	appendToDBs(sfx) {
		if (this.winStream) {this.stillWriting++;this.winStream.write(sfx.win_entry+'\n',() => {this.stillWriting--})}
		if (this.macStream) {this.stillWriting++;this.macStream.write(sfx.mac_entry+'\n',() => {this.stillWriting--})}	
	}

	closeStreams() {
		if (this.stillWriting > 0) {
			setTimeout(() => {this.closeStreams()},1000)
		} else {
			if (this.winStream) {this.winStream.end()}
			if (this.macStream) {this.macStream.end()}	
		}
	}
}

class row {
	constructor(filePath) {
		this.path = filePath
		Object.assign(this,path.parse(filePath))
		this.dateAdded = todayDate
		
		let stat = fs.statSync(this.path)
		this.file_size_low32 = stat.size;
		this.file_size_hi32 = 0;
		this.file_date_sec_since_1970 = Math.floor(stat.mtimeMs / 1000)
	}	

	get isValid() {
		return (this.file_size_low32 > 0)
	}

	get col() {
		let rowObj = {
			root:this.root,
			dir:this.dir,
			name:this.name,
			ext:this.ext,
			file_size_low32:this.file_size_low32,
			file_size_hi32:this.file_size_hi32,
			usertag:this.usertag || 'NULL',
			description:this.description || 'NULL',
			user:prg.user || 'NULL',
			file_date_sec_since_1970:this.file_date_sec_since_1970,
			date_added:this.dateAdded
		}
		return rowObj
	}

	get insertQuery() {
		return [this.col.root,this.col.dir,this.col.name,this.col.ext,this.col.file_size_low32,this.col.file_size_hi32,this.col.file_date_sec_since_1970,this.col.user,this.col.usertag,this.col.description,this.col.date_added]
	}

	get mac_path() {
		let regex = /\\/gi
		return path.posix.join(this.dir,this.name).replace(regex,'/') + this.ext
	}

	get mac_entry() {
		let entryString = `FILE "${this.mac_path}" ${this.file_size_low32} ${this.file_size_hi32} ${this.file_date_sec_since_1970}`
		if (this.usertag || this.description) {
			entryString += "\nDATA "
			if (this.mediaDBUsertag) {
				entryString += `"u:${this.usertag}" `
			}
			if (this.mediaDBdescription) {
				entryString += `"d:${this.description}" `
			}
		}
		return entryString
	}

	get win_path() {
		let regex = /\//gi
		return path.win32.join(this.dir,this.name).replace(regex,'\\') + this.ext
	}

	get win_entry() {
		let entryString = `FILE "${this.win_path}" ${this.file_size_low32} ${this.file_size_hi32} ${this.file_date_sec_since_1970}`
		if (this.usertag || this.description) {
			entryString += "\nDATA "
			if (this.mediaDBUsertag) {
				entryString += `"u:${this.usertag}" `
			}
			if (this.mediaDBdescription) {
				entryString += `"d:${this.description}" `
			}
		}
		return entryString
	}
}

class silverDatabase {
	constructor(configs) {
		Object.assign(this,configs)
		this.insertChunkSize = 500
		this.sentQueries = 0
		this.duplicates = 0
		this.finished = defer()
		this.addedFiles = 0
		this.totalQueries = 0

		this.queryTemplate = 'INSERT INTO media (root,dir,name,ext, file_size_low32, file_size_hi32, file_date_sec_since_1970, user, usertag, description, date_added) VALUES (?,?,?,?,?,?,?,?,?,?,?)'

		this.dbConfig = config.sqldb
	}

	verifyDatabaseIsAvailable() {
		return new Promise((resolve,reject) => {
			mariadb.createConnection(this.dbConfig)
				.then(conn => {
					conn.end()
					resolve()
				})
				.catch(err => {
					reject(err)
				})
		})
	}

	initPool() {
		return new Promise((resolve,reject) => {
			this.verifyDatabaseIsAvailable()
				.then(() => {
					this.pool = mariadb.createPool(this.dbConfig)
					resolve()
				})
				.catch(err => {
					log.error("couldn't connect to database")
					reject(err)
				})	
		})
		
	}

	close() {
		this.pool.end()
	}

	reliablyGetConnection() {
		return new Promise((resolve,reject) => {
			function insist(that) {
				that.pool.getConnection()
					.then(conn => {resolve(conn)})
					.catch(err => {
						if (err.errno == TIMEOUT) {
							setTimeout(() => {insist(that)},1000)
						} else {	
							reject(err)
						}
					})	
			}
			insist(this)
		})
	}

	insert(sfxArray) {
		this.totalQueries += sfxArray.length
		let connection
		this.reliablyGetConnection()
			.then(conn => {
				connection = conn
				connection.beginTransaction()
					.then(() => {
						let currentQueries = []
						sfxArray.forEach(sfx => {
							let queryPromise = connection.query(this.queryTemplate,sfx.insertQuery)
								.then(() => {this.addedFiles++;rdb.appendToDBs(sfx)})
								.catch(err => {
									if (err.errno != DUPLICATED) {log.error('QUERY:' + err.errno + ':' + sfx.path)} else {this.duplicates++}
								})
								.finally(() => {this.sentQueries++})
							currentQueries.push(queryPromise)	
						})

						Promise.all(currentQueries)
							.then(() => {
								connection.commit()
									.catch(err => {connection.rollback()})
									.finally(() => {
										connection.end()
											.then(() => {
												if (this.queueFilledFlag() && this.totalQueries == this.sentQueries) {this.finished.resolve()}
											})
									})
							})
					})
			})
			.catch(err => {log.errObj(err)})

	}	 
}

class queue {
	constructor(configs) {
		Object.assign(this,configs)
		this.array = []
		this.totalEntries = 0
		this.finished = defer()
	}

	add(element) {
		if (!element) return
		if (Array.isArray(element)) {
			this.totalEntries =+ element.length
			this.array.push.apply(this.array,element)
		} else { 
			this.totalEntries++
			this.array.push(element)
		}

		if (this.length >= this.chunkSize) {
			this.chunkReadyTrigger()
		}
	}
 
	allElementsAddedTrigger() { 
		this.chunkReadyTrigger()
		this.queueFilled = true
		this.finished.resolve()
	}

	chunkReadyTrigger() {
		this.chunkTriggerFunction(this.shift(this.chunkSize))
	}

	shift(n) {
		return this.array.splice(0,n)
	} 

	get length() {
		return this.array.length
	}
}

function tryToAddFile(filePath,relativeDir) {
	return new Promise((resolve,reject) => {
		let fileExt = path.parse(filePath).ext.toLowerCase()
		if (fileExt == '.wav' || fileExt == '.aiff' || fileExt == '.mp3') {
			ensureFileIsInLib(filePath,config.library,prg.user,relativeDir)
				.then(filePath => {
					let sfx = new row(filePath)
					if (sfx.isValid) {q.add(sfx)}
					resolve(filePath)			
				})
				.catch(err => {reject(err)})
		} else {
			resolve()
		}
	})
}


function walkPath(inputPath,onGoingWalkers) {
	
	options = {
		followLinks: false, 
		filters: ["peaks"]
	};

	walker = walk.walk(inputPath,options)
	

	walker.on("file", function (root, fileStats, next) {
		let relativeDir = root.substring(path.parse(inputPath).dir.length+1)
		tryToAddFile(path.join(root,fileStats.name),relativeDir).then(() => {next()})
	});

	walker.on("errors", function (root, nodeStatsArray, next) {
		next();
	});

	walker.on("end", function () {
		onGoingWalkers[0]--
	  	if (onGoingWalkers[0] == 0) q.allElementsAddedTrigger()
	});
}

let db
let q
let rdb
let prg
let config

// execution


function main(input,conf) {
	prg = input
	config = conf
	db = new silverDatabase({queueFilledFlag:() => {return q.queueFilled}})
	q = new queue({
						chunkSize:db.insertChunkSize,
						chunkTriggerFunction: function (arg) {db.insert(arg)},
					})
	rdb = new reaperDB(config.win_db,config.mac_db,'a')

	start = process.hrtime()

	rdb.verifyFilesAreWritable()
	.then(() => {
		db.initPool()
			.then(() => {
				let pathsToProcess = [prg.args.length]
			  	prg.args.forEach((userPath) => {
			  		if (fs.lstatSync(userPath).isDirectory()) {
			  			walkPath(userPath,pathsToProcess)
			  		} else if (fs.lstatSync(userPath).isFile()) {
			  			tryToAddFile(userPath).then(() => {
			  				pathsToProcess[0]--
			  				if (pathsToProcess[0] == 0) q.allElementsAddedTrigger()	
			  			})
			  		} else {pathsToProcess[0]--}
			  	})

			})
			.catch(err => {log.errObj(err);process.exit()})

		Promise.all([q.finished,db.finished]).then(()=>{
			rdb.closeStreams()
			clearInterval(monitor)
			log.update.clear()
			log.info('duplicates:'+db.duplicates+' | added:'+db.addedFiles+' | queries:'+db.sentQueries)
			db.close()

			hrend = process.hrtime(start)
			log.verbose('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)
		})

		let i = 0
		monitor = setInterval(() => {
			i++
		    log.update(`filesOnQueue:${q.totalEntries} | SentQueries:${db.sentQueries} | ${i}`);
		}, 80);	
	})
	.catch(err=>{
		log.error('Reaper DBs couldn\'t be found')
		process.exit()
	})
}

