#!/usr/bin/env node

const fs = require('fs');
const program = require('commander');
const path = require('path'); 

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('cli')
log.verbose(`cli input: ${process.argv.slice(2)}`)

var config;
try { 
	if (process.pkg) {
		config = require(path.resolve(path.dirname(process.execPath),'config.json'))
	} else {
		config = require(path.resolve(__dirname,'..','..','config.json'))	
	}
}
catch(err) {if (err.code == 'MODULE_NOT_FOUND') {log.error('config file not found');process.exit()}}

program
	.version(require(path.resolve(__dirname,'..','package.json')).version)
	.option('-q, --quiet','Supress all console prints ')

program	
	.command('add')
	.description('Add files/folders to SilverDB')
	.arguments('<JSON>')
	.action((input,cmd) => {
		if (program.quiet) {log.quiet()}

		input = readJsonBatch(input)

		require(path.resolve(__dirname,'add.js')).main(input,config)
	})

program
	.command('deduplicate')
	.description('Remove duplicate entries from DB')
	.action((input) => {
		if (program.quiet) {log.quiet()}
		
		input = readJsonBatch(input)	

		require(path.resolve(__dirname,'deduplicate.js'))(input)
	})

program
	.command('test')
	.description('Test connections to server')
	.action(() => {
		if (program.quiet) {log.quiet}
			require(path.resolve(__dirname,'test.js'))()
	})

program.parse(process.argv)

//

function validatePath(p) {
	if (!fs.existsSync(p)) {
		log.error(`${p} is not a valid path`)
		process.exit()
	} else {
		return p
	} 
}

function readJsonBatch(file) {
	if (!fs.existsSync(file)) {
		log.error(`Filelist ${file} doesn't seem to exist`)
		process.exit(1)
	} else {
		return require(file)
	}
}