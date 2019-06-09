#!/usr/bin/env node

const fs = require('fs');
const program = require('commander');
const path = require('path'); 

const log = require(path.resolve(__dirname,'..','lib','logger.js'))('cli')
log.registerExceptionHandler()
log.verbose(`cli input: ${process.argv.slice(2)}`)

program
	.version(require(path.resolve(__dirname,'..','package.json')).version)
	.option('-q, --quiet','Supress all console prints ')

program	
	.command('add')
	.description('Add files/folders to Reaper Databases')
	.arguments('<JSON>')
	.action((input,cmd) => {
		if (program.quiet) {log.quiet()}

		input = readJsonBatch(input)

		require(path.resolve(__dirname,'add.js')).main(input)
	})

program
	.command('deduplicate')
	.description('Remove duplicate entries from DB')
	.option('-m, --manual',"Manual mode. ")
	.arguments("<JSON|DBs...>")
	.action((input,cmd) => {
		if (program.quiet) {log.quiet()}

		let dedupParams = []
		if (!cmd.manual) {
			dedupParams = readJsonBatch(path.resolve(input[0]))
		} else {
			input.forEach(db => {dedupParams.push(path.resolve(db))})
		}

		require(path.resolve(__dirname,'deduplicate.js'))(dedupParams)
	})

program
	.command('export')
	.description('Export DBs')
	.option('-m, --manual','Manual mode. Last arguments should be Database path')
	.option('-l, --newLibrary <string>','New library path (will replace currentLib in DBs)')
	.option('-c, --currentLib <string>','Current Library Path to be replaced')
	.option('-d, --destination <string>', 'Destination in which to save new db files ')
	.option('-n, --name <string>','Shortcut name')
	.arguments('<JSON|DBPath(manual)>')
	.action((input,cmd) => {
		if (program.quiet) {log.quiet()}
		
		input = path.resolve(input)

		let exportParams
		if (!cmd.manual) {
			exportParams = readJsonBatch(input)	
		} else {
			if (!cmd.newLibrary) {log.error('Missing newLibrary option') ; process.exit(1)}
			if (!cmd.currentLib) {log.error('Missing currentLib option') ; process.exit(1)}
			if (!cmd.destination) {log.error('Missing destination option') ; process.exit(1)}

			exportParams = {
				newLib: cmd.newLibrary,
				currentLib: cmd.currentLib,
				destination: cmd.destination,
				dbList: [{ref: input}]
			}
			if (typeof cmd.name === 'string') {exportParams.dbList[0].name = cmd.name}
		}
		
		require(path.resolve(__dirname,'export.js')).main(exportParams)
	})

program.parse(process.argv)

function readJsonBatch(file) {
	if ( !/\.json/i.test(path.extname(file) )) {
		log.error(`File ${file} doesn't seem to be a json file`)
		process.exit(1)
	}
	if (!fs.existsSync(file)) {
		log.error(`File ${file} doesn't seem to exist`)
		process.exit(1)
	} else {
		//TODO check if is valid json
		return require(file)
	}
}