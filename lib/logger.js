module.exports = createWinstonLogger

const winston = require('winston')
const path = require('path')
const fs = require('fs')

class winston_logger {
	constructor(llabel) {
		var logdir
		if (process.pkg) {
			logdir = path.join(path.dirname(process.execPath),'logs')
		} else {
			logdir = path.join(__dirname,'..','logs')
		}

		if (!fs.existsSync(logdir)){
		    fs.mkdirSync(logdir);
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
		    new winston.transports.File({ filename: path.join(logdir,'error.log'), level: 'error' }),
		    new winston.transports.File({ filename: path.join(logdir,'combined.log'), level: 'verbose' })
		  ],
		  // waiting for winston 3.2 release
		  // exceptionHandlers: [
		  //   new winston.transports.File({ filename: path.join(__dirname,'logs','exceptions.log'),exitOnError:false}),
		  //   new winston.transports.Console({format: winston.format.cli()})
		  // ]
		});

		this.update = require('log-update')


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
		this.logger.verbose(message)	
	}
}

function createWinstonLogger(llabel) {
	return new winston_logger(llabel)
}

