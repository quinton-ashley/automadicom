/*
 * automadicom.js by Quinton Ashley for use at QTUltrasound
 * Open Source MIT Licensed
 */

// TODO

// button on input screen
// StudyInstanceUID and SeriesInstanceUID

// replace instead of remove

const chalk = require('chalk'); // terminal text coloring library
const CSV = require('csv-string'); // csv parser and stringifier
const dcmtk = require(__rootDir + '/core/dcmtk.js'); // my nodejs dcmtk library
const deepExtend = require('deep-extend');
const strSim = require('string-similarity'); // string similarity algorithm
const {
	renderPaths
} = require('tree-from-paths');

const er = (ror) => {
	global.er(chalk.red(ror));
}

let version = require(__rootDir + '/package.json').version;
global.usrDir = os.homedir() + '/Documents/automadicom';
if (win) usrDir = path.nx(usrDir);

let inDir;
let dcmFilePaths; // input file paths
let fidx = 0; // the current file index
let outDir;
let outPaths = []; // the new path of the files

let dict; // dictionary with tag key to value pairs
let rules = {};
let append = [];
let failed = []; // files that failed

var a = 0;

class AutomaDicom {
	constructor() {
		this.dictID;
		this.configs = {};
	}

	async test() {
		// await this.loadConfigFiles();
		// await delay(1000000);
	}

	async setup() {
		log('automadicom by quinton-ashley');
		log('-i input -o output -h help');
		if (arg.h || arg.help) {
			//TODO cli help
			log('TODO');
			return;
		}

		this.dictID = await fs.readFile(__rootDir + '/db/dictID.json', 'utf8');
		this.dictID = JSON.parse(this.dictID);

		await dcmtk.setup(usrDir);
		await fs.ensureDir(usrDir + '/input');
		await fs.ensureDir(usrDir + '/output');
		await fs.ensureDir(usrDir + '/logs');
		if (!(await fs.exists(usrDir + '/config'))) {
			log('copying config files');
			await fs.ensureDir(usrDir + '/config');
			let files = await klaw(__rootDir + '/config');
			for (let file of files) {
				log(__rootDir);
				log(usrDir);
				await fs.copy(file, usrDir + '/' + path.relative(__rootDir, file));
			}
		}
		await this.loadConfigFiles();
	}

	async start(arg) {
		if (!dcmFilePaths) await this.setup();

		for (let i = 0; i < dcmFilePaths.length; i++) {
			// try {
			await this.edit(i);
			// continue;
			// } catch (ror) {
			// 	er(ror);
			// 	failed.push(i);
			// }
			// outPaths.push('');
		}
		// if (!arg.n) {
		// 	await this.copyNonDicomFiles();
		// }

		if (failed.length >= 1) {
			er('failed for files:');
			for (let fidx in failed) {
				er(dcmFilePaths[fidx]);
			}
		} else {
			log(chalk.green('100% success'));
		}
		let date = new Date().toString().replace(/\:/g, ' ');
		let logFile = usrDir + '/logs/' + date + '.txt';
		await fs.outputFile(logFile, this.results());
	}

	getInputDir() {
		return inDir;
	}

	async setInput(input) {
		inDir = input || arg.i || arg.input || usrDir + '/input';

		log('input: ' + inDir + '\n');
		if (!(await fs.exists(inDir))) {
			er('Input path does not exist!');
			return;
		}
		// if the input path is a directory send it straight to the setup function
		// else glob for leaves of the fs
		if ((await fs.stat(inDir)).isDirectory()) {
			// looks for files with no extensions, because sometimes DICOM files
			// will be improperly named
			let allFiles = await klaw(inDir);
			dcmFilePaths = [];
			for (let file of allFiles) {
				if (path.parse(file).base[0] != '.' &&
					!(await fs.stat(file)).isDirectory() &&
					file.match(/^(.*\.(dcm|bak)|.*\.\d+|.*(\/|\\)[^.]+)$/gmi)) {
					dcmFilePaths.push(path.nx(file));
				}
			}
		} else {
			dcmFilePaths = [inDir];
		}
		if (dcmFilePaths === undefined || dcmFilePaths.length == 0) {
			er('invalid path, no files found');
			return;
		}
		log(dcmFilePaths);
		return dcmFilePaths;
	}

	async setOutputDir(output) {
		outDir = output;
		log('Output Dir: ' + outDir);
	}

	async loadConfigFiles() {
		let files = await klaw(usrDir + '/config');
		for (let file of files) {
			log(file);
			if ((await fs.stat(file)).isDirectory()) continue;
			let config = await fs.readFile(file, 'utf8');
			file = path.parse(file);
			if (file.ext == '.json') {
				this.configs[file.name] = JSON.parse(config);
			} else {
				append = CSV.parse(config, '\n');
				for (let i in append) {
					append[i] = append[i][0];
				}
			}
		}
	}

	async saveConfigFile(configName) {
		let filePath = usrDir + '/config/';
		filePath += configName.replace(/ /g, '_') + '.json';
		delete this.configs[configName].enabled;
		let file = JSON.stringify(this.configs[configName]);
		await fs.outputFile(filePath, file);
	}

	isConfigEnabled(configName) {
		if (!this.configs[configName]) {
			log('config not found');
			return null;
		}
		if (this.configs[configName].enabled == null) {
			this.configs[configName].enabled = false;
		}
		return this.configs[configName].enabled;
	}

	toggleConfig(configName, enabled) {
		this.configs[configName].enabled = enabled;
		log(configName + ' is ' + enabled);
	}

	getRules() {
		rules = {};
		for (let configName in this.configs) {
			let config = this.configs[configName];
			if (!config.enabled) continue;
			deepExtend(rules, config.rules);
		}
		return rules;
	}

	// flatten tag object to conform to a single level for displaying
	// tag data in the tag editor table
	flattenTags(meta, level, idBase) {
		if (!level) level = 0;
		if (!idBase) idBase = '';
		let tags = [];
		let i = 0;
		for (let id in meta) {
			let tag = meta[id];
			if (tag.id) {
				continue;
			}
			tag.name = this.dictID[id] || 'UnknownTagName';
			if (level == 0) tag.pos = i;
			if (level >= 1) tag.pos = idBase + '.' + i;
			tag.id = id.substr(0, 4) + '_' + id.substr(4, 8);
			if (!tag.Value) {
				tag.value = '';
				delete tag.Value;
				continue;
			}
			let sub;
			if (typeof tag.Value[0] != 'object') {
				if (tag.Value.length == 1) {
					tag.value = tag.Value[0];
				} else {
					if (typeof tag.Value[0] == 'number') {
						tag.value = '[' + tag.Value.toString() + ']';
					} else if (typeof tag.Value[0] == 'string') {
						tag.value = '[';
						for (let i in tag.Value) {
							if (!tag.Value[i]) break;
							if (i != 0) tag.value += ',';
							// tag.value += '&quot;' + tag.Value[i] + '&quot;';
							tag.value += tag.Value[i];
						}
						tag.value += ']';
					}
				}
			} else if (tag.Value[0].Alphabetic) {
				tag.value = tag.Value[0].Alphabetic;
			} else {
				tag.value = '[ ... ]';
				sub = tag.Value[0];
			}
			tag.edit = '';
			delete tag.Value;
			tags.push(tag);
			if (sub) {
				tags = tags.concat(this.flattenTags(sub, level + 1, tag.pos));
			}
			i++;
		}
		return tags;
	}

	async getTags(file) {
		file = this._fileAmb(file);
		log(file);
		let meta = await dcmtk.getTags(file);
		return this.flattenTags(meta);
	}

	async edit(file, tags) {
		file = this._fileAmb(file);
		tags = tags || await this.getTags(file);
		let values = await this.evalRules(tags);
		log(values);

		let outPath = await this.getOutPath(file, tags, values);
		if (!arg.s) log('writing: ' + outPath + '\n');

		await fs.copy(file, outPath);
		await dcmtk.modifyTags(outPath, values);
		outPaths.push(outPath);
		await fs.remove(outPath + '.bak');
	}

	// solve file arg ambivalence
	_fileAmb(file) {
		if (typeof file == 'string') {
			fidx = dcmFilePaths.indexOf(file);
		} else {
			fidx = file;
			file = dcmFilePaths[fidx];
		}
		return file;
	}

	async getOutPath(file, tags, values) {
		file = this._fileAmb(file);
		// let's decide where to write the file
		let dir, imgName;
		let outPath = '';
		if (outDir) {
			dir = outDir;
			for (let i = 0; i < append.length - 1; i++) {
				dir += '/' + await this.evalRule(append[i], tags, values);
			}
			imgName = await this.evalRule(append[append.length - 1], tags, values);
			// at the end of this loop it is assured that a unique file name has
			// been created
			for (let i = 0; outPath == '' ||
				outPaths.includes(outPath) ||
				(await fs.exists(outPath)); i++) {
				if (i >= 1) {
					outPath = `${dir}/${i.toString()}_${imgName}`;
				} else {
					outPath = `${dir}/${imgName}`;
				}
			}
		} else {
			// get the directory of the file
			dir = path.parse(file).dir;
			// prepend anon_ to the file name
			imgName = 'anon_' + path.parse(file).name + '.dcm';
			outPath = dir + '/' + imgName;
		}
		return outPath;
	}

	getTagValue(name, tags) {
		let tag = tags.find(x => x.name === name) || {};
		return tag.edit || tag.value;
	}

	async previewChanges(file, tags) {
		file = this._fileAmb(file);
		tags = tags || await this.getTags(file);
		let values = await this.evalRules(tags);
		for (let i in tags) {
			if (values[tags[i].name]) {
				tags[i].edit = values[tags[i].name];
			} else {
				tags[i].edit = tags[i].value;
			}
		}
		return tags;
	}

	async evalRules(tags) {
		rules = this.getRules();
		let values = {};
		for (let tagName in rules) {
			values[tagName] = await this.evalRule(rules[tagName], tags, values);
		}
		return values;
	}

	async evalRule(rule, tags, values) {
		let match, reqTag, tagReq;
		let useOgVal = false;
		let editIdx = -1;
		let regex = /\$[\w|\-|_]*/i;
		// loops while a match is found
		while (match = regex.exec(rule)) {
			useOgVal = (match[0][1] == '$');
			tagReq = match[0].slice(((useOgVal) ? 2 : 1), match[0].length);
			// if the original value of the tag is requested
			// or if the tag requested is not found in tags
			// or if the tag requested is found in tags but does not yet have a value
			if (useOgVal || (!values[tagReq] &&
					(editIdx = this.getTagValue(tagReq, tags)))) {
				// get the tag from the zero level DICOM by name
				reqTag = this.getTagValue(tagReq, tags);
				// if it's still null it wasn't found
				if (reqTag == null) {
					er(`Error: ${tagReq} tag not found!!`);
					reqTag = 'null';
				}
				reqTag = reqTag.replace('\u0000', '');
			} else if (tagReq.includes('file')) {
				reqTag = path.parse(dcmFilePaths[fidx]);
			} else if (tagReq == 'index') {
				reqTag = fidx;
			} else if (values[tagReq]) {
				reqTag = values[tagReq];
			}
			// replace the request with the tag itself, the quotes are necessary
			if (typeof reqTag == 'string') {
				reqTag = `'${reqTag}'`;
			} else {
				reqTag = '(' + JSON.stringify(reqTag) + ')';
			}
			rule = rule.replace('$' + tagReq, reqTag);
		}
		// note that eval is used to evaluate user javascript dynamically!
		// direct access to String methods gives users advanced control
		let res;
		try {
			res = eval(rule);
		} catch (ror) {
			res = rule;
		}
		return res;
	}

	errorCheck(name, value) {
		switch (name) {
			case 'AcquisitionDate':
			case 'ContentDate':
			case 'InstanceCreationDate':
			case 'PatientBirthDate':
			case 'StudyDate':
				if (typeof value !== 'string') {
					throw new Error(`${name} ${value}
Dates must be entered as a String in a standard format, ex:'YYYYMMDD'
					`);
				}
				let isYear = (parseInt(value.slice(0, 4)) >= 1900);
				let isMonth = (parseInt(value.slice(4, 6)) <= 12);
				let isDay = (parseInt(value.slice(6, 8)) <= 31);
				if ((!isYear || !isMonth || !isDay)) {
					log(`${name} ${value}
Dates must be entered as a String in a standard format, ex:'YYYYMMDD'
					`);
				}
				break;
			case 'AcquisitionTime':
			case 'ContentTime':
			case 'InstanceCreationTime':
			case 'PatientBirthTime':
			case 'StudyTime':
				if (typeof value !== 'string') {
					throw new Error(`${name} ${value}
Times must be entered as a String in a standard format, ex:'HHMMSS'
					`);
				}
				break;
			default:
		}
	}

	results() {
		let res = '';
		for (let i in dcmFilePaths) {
			res += dcmFilePaths[i] + '\n';
			res += ((outPaths[i]) ? outPaths[i] : 'failed') + '\n';
		}
		let resTree = renderPaths(outPaths.filter((outPath) => {
				return outPath;
			}), outDir,
			(parent, file, explicit) => {
				return file;
			}
		);
		res += '\nRESULTS TREE:\n\n' + resTree;
		return res;
	}

}

module.exports = new AutomaDicom();
