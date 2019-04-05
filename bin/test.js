module.exports = main

const listr = require('listr')
const fs = require('fs')
const path = require('path')

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('test')

var config

const configExists = {
	title: 'Looking for Config file',
	task: () => {
		// try { config = require(path.resolve(__dirname,'..','config.json'))}
		try { 
			if (process.pkg) {
				config = require(path.resolve(path.dirname(process.execPath),'config.json'))
			} else {
				config = require(path.resolve(__dirname,'..','..','config.json'))	
			}
		}
		catch(err) {if (err.code == 'MODULE_NOT_FOUND') {log.error('config file not found');process.exit()}}
	}
}

const libraryIsWritable = {
	title: 'Looking for Media folder',
	task: () => {
		try{fs.accessSync(config.library, fs.constants.W_OK)}
		catch(err) {throw new Error('Media folder doesn\'t exist or this script can\'t write to it')}
	}
}

const reaperDBIsWritable = {
	title: 'Looking for Reaper Databases folder',
	task: () => {
		try{
			fs.accessSync(config.databases, fs.constants.W_OK)
		}
		catch(err) {throw Error('The Databases folder on SilverPi doesn\'t exist or this script can\'t write to it')}
	}
}


const tasks = new listr([
	configExists,
	libraryIsWritable,
	reaperDBIsWritable
	])

function main() {
	tasks.run()
	.then(() => {log.info(' All Tests completed successfully')})
	.catch(err => {});	
}
