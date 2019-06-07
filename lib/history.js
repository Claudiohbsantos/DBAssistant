module.exports = createHistoryLogger

const path = require('path')
const fs = require('fs')
const os = require('os');

function getTimestamp() {
	let date = new Date()
	return date.getFullYear() + '-' + (date.getMonth()+1) + '-' +date.getDate() + '_' + date.getHours() + '-' + date.getMinutes()	
}

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

class historyLogger {
	constructor(user,LibFolder) {
		this.user = user
		this.libDir = new RegExp('^'+escapeRegExp(LibFolder),'i')

		let logdir = path.join(LibFolder,"DBA_history")
		if (!fs.existsSync(logdir)){
		    fs.mkdirSync(logdir);
		}

		this.filePath = path.join(logdir,getTimestamp() + '_' + this.user + '.txt')
		this.sep = '----------------------------------------------------------------------------------\n'
		this.history = ''
	}


	createHeader(addedFiles) {
		this.history = `${getTimestamp()}
User: ${this.user}
Computer: ${os.hostname()}
DBAssistant Version: ${require(path.resolve(__dirname,'..','package.json')).version}
Added Files: ${addedFiles}
${this.sep}\n` + this.history
	}

	log(filePath,dbs) {
		filePath = filePath.replace(this.libDir,'')
		this.history += filePath + ' -> '
		dbs.forEach(db => {this.history += db + ','})
		this.history += '\n'
	}

	write(){
		let fd = fs.openSync(this.filePath,'w')
		fs.writeSync(fd,this.history)
		fs.closeSync(fd)
	}

	email() {

	}
}

function createHistoryLogger(user,LibFolder) {
	return new historyLogger(user,LibFolder)
}
