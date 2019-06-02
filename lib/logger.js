module.exports = createWinstonLogger

const winston = require('winston')
const path = require('path')
const fs = require('fs')

class winston_logger {
	constructor(llabel) {
		if (process.pkg) {
			this.logdir = path.join(path.dirname(process.execPath),'logs')
		} else {
			this.logdir = path.join(__dirname,'..','logs')
		}

		if (!fs.existsSync(this.logdir)){
		    fs.mkdirSync(this.logdir);
		}

		this.logger = winston.createLogger({
		  level: 'info',
		  format: winston.format.combine(
		  	winston.format.label({label:llabel}),
		  	winston.format.timestamp({format:'YYYY-MM-DD HH:mm:ss'}),
		  	winston.format.printf(info => {return `${info.timestamp}\t[${info.label}]\t${info.level}:\t${info.message}`;}),
		  ),
		  defaultMeta: {service: 'user-service'},
		  transports: [
		  	new winston.transports.Console({format: winston.format.cli()}),
		    new winston.transports.File({ filename: path.join(this.logdir,'error.log'), level: 'error' }),
		    new winston.transports.File({ filename: path.join(this.logdir,'combined.log'), level: 'verbose' })
		  ],

		});

		this.update = require('log-update')
	}

	registerExceptionHandler() {
		this.logger.exceptions.handle(
			new winston.transports.File({ filename: path.join(this.logdir,'exceptions.log')}),
			new winston.transports.Console({format: winston.format.errors({stack:false})})
		)
	}

	quiet() {
		this.logger.transports.find(obj => obj.name === 'console').level = 'error'
		this.update = () => {};
		// console.log(this.logger.transports.find(obj => obj.name === 'console'))
	}

	log(message) {
		this.logger.log('info',message)
	}

	error(message) {
		this.logger.error(message)
	}

	errObj(err) {
		this.logger.error(`${(err.errno || '')} : ${err.message}`)
	}

	warn(message) {
		this.logger.warn(message)
	}

	info(message) {
		this.logger.info(message)
	}

	verbose(message) {
		this.logger.verbose(message.replace(/[\n\r]/,'\\n'))	
	}
}

function createWinstonLogger(llabel) {
	return new winston_logger(llabel)
}

