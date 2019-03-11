const chalk = require('chalk'); // open source terminal text coloring library
const CSV = require('csv-string'); // open source csv parser and stringifier
const dcmtk = require(__rootDir + '/core/dcmtk.js'); // my nodejs dcmtk bindings library
const flatten = require('flat');
const strSim = require('string-similarity'); // open source string similarity algorithm
const {
	render
} = require('tree-from-paths');

const er = (ror) => {
	global.er(chalk.red(ror));
}

let version = require(__rootDir + '/package.json').version;
const usrDir = os.homedir() + '/Pictures/' + path.parse(__rootDir).base;

let inPath;
let files; // input file paths
let fidx = 0; // the current file index

let outDir;
let append;
let outPaths; // the new path of the files

let dict; // dictionary with tag key to value pairs

let tags; // tags we want to edit
let rules; // rules that get evaluated to make the tag's new value
let values; // (for the cur fidx) stores the future values of the tags

let failed; // files that failed

var a = 0;

class AutomaDicom {
	constructor() {}

	async setup() {
		log('automadicom by quinton-ashley');
		log('-i input -o output -h help');
		if (opt.h || opt.help) {
			//TODO cli help
			log('TODO');
			return;
		}

		dict = await fs.readFile(__rootDir + '/db/dicom.json', 'utf8');
		dict = JSON.parse(dict);

		await this.setInput();
		await this.setOutputDir();
		await this.loadRulesFile();
		await this.loadAppendFile();
	}

	async start(opt) {
		if (!dict) await this.setup();

		for (let i = 0; i < files.length; i++) {
			if ((!(await fs.stat(files[i])).isDirectory()) &&
				files[i].match(/^(.*\.dcm|.*\.\d+|.*(\/|\\)[^.]+)$/gmi) &&
				!files[i].match(/dir/i)) {

				try {
					await this.edit(i);
					continue;
				} catch (ror) {
					er(ror);
					failed.push(i);
				}
			}
			outPaths.push('');
		}
		if (!opt.n) {
			await this.copyNonDicomFiles();
		}

		if (failed.length >= 1) {
			er('failed for files:');
			for (let fidx in failed) {
				er(files[fidx]);
			}
		} else {
			log(chalk.green('100% success'));
		}
		await fs.outputFile(usrDir + '/logs/' + new Date().toString() + '.txt', results());
	}

	async setInput(input) {
		if (input) {
			inPath = input;
		} else {
			if (files) return;
			inPath = opt.i || opt.input || usrDir + '/input';
		}

		log('');
		log('input: ' + inPath + '\n');
		if (!(await fs.exists(inPath))) {
			er('Input path does not exist!');
			return;
		}
		// if the input path is a directory send it straight to the setup function
		// else glob for leaves of the fs
		if ((await fs.stat(inPath)).isDirectory()) {
			// looks for files with no extensions, because sometimes DICOM files
			// will be improperly named
			files = await klaw(inPath);
			if (!opt.n && opt.c) {
				await this.cleanEmptyFoldersRecursively(inPath);
			}
		} else {
			files = [inPath];
		}
		if (files === undefined || files.length == 0) {
			er('invalid path, no files found');
			return;
		}
		log(files);
		return files;
	}

	async setOutputDir(output) {
		if (output) {
			outDir = output;
		} else {
			if (outDir) return;
			outDir = opt.o || opt.output || usrDir + '/output'
		}
	}

	async loadRulesFile(rulesFile) {
		let rulesText;
		if (!rulesFile) {
			rulesFile = opt.r || opt.rules || usrDir + '/rules.csv';
		}
		rulesText = await fs.readFile(rulesFile, 'utf8');
		this.setRules(rulesText);
	}

	setRules(rulesText) {
		if (opt.m) {
			return;
		}

		let lines = CSV.parse(rulesText, ';');
		if (lines.length <= 1) {
			er('rules files has no rules!');
			return;
		}
		tags = [];
		rules = [];
		for (let line of lines) {
			tags.push(line[0]);
			rules.push(line[1]);
		}
	}

	async loadAppendFile(appendFile) {
		if (!appendFile) {
			appendFile = opt.a || opt.append || usrDir + '/append.csv';
		}
		append = CSV.parse(await fs.readFile(appendFile, 'utf8'), ';');
	}

	setAppend(appendArr) {
		append = appendArr;
	}

	async getTags(file) {
		file = this._fileAmb(file);
		log(file);
		let meta = await dcmtk.getTags(file);
		log(meta);
		meta = flatten(meta);
		return meta;
	}

	async edit(file) {
		file = this._fileAmb(file);
		if (!opt.s) {
			log('loading: ' + file);
		}
		this.getTags();
		if (opt.l) {
			log(JSON.stringify(data, null, 2));
		}

		if (!opt.m) {

			for (let i = 0; i < tags.length; i++) {
				let tag = tags[i];
				values.push(await fulfillTagReqs(rules[i]));
				errorCheck(tag, values[i]);
			}
			if (!opt.s) {
				log(file + ' : ');
				for (let i = 0; i < values.length; i++) {
					log(`${tags[i]} = ${values[i]}`);
				}
			}
		}
		let outPath = await getOutPath(file);
		if (!opt.s) {
			log('writing: ' + outPath + '\n');
		}


		if (!opt.n) {
			// if option m (move only) is false then write the new file to the output
			// location, else move the original file to the output location
			if (!opt.m) {
				// await fs.copy(todo, outPath);
				// await fs.unlink();
			} else {
				await fs.copy(file, outPath);
			}
		}
		outPaths.push(outPath);

		if (!opt.n && opt.c) {
			// if running with option c, delete the original file
			await fs.unlink(file);
		}
	}

	// solve file arg ambivalence
	_fileAmb(file) {
		if (typeof file == 'string') {
			fidx = files.indexOf(file);
		} else {
			fidx = file;
			file = files[fidx];
		}
		return file;
	}

	async getOutPathFor(file) {
		file = this._fileAmb(file);
		// let's decide where to write the file!
		let dir, imgName;
		let outPath = '';
		if (outDir) {
			dir = outDir;
			for (i = 0; i < append.length - 1; i++) {
				dir += '/' + await fulfillTagReqs(append[i][0]);
			}
			imgName = await fulfillTagReqs(append[append.length - 1][0]);
			// at the end of this loop it is assured that a unique file name has been created
			for (i = 0; outPath == '' || outPaths.includes(outPath) || (await fs.exists(outPath)); i++) {
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

	async fulfillTagReqs(str) {
		let match, reqTag, tagReq;
		let useOgVal = false;
		let editIdx = -1;
		let regex = /\$[\w|\-|_]*/i;
		// loops while a match is found
		while (match = regex.exec(str)) {
			useOgVal = (match[0][1] == '$');
			tagReq = match[0].slice(((useOgVal) ? 2 : 1), match[0].length);
			// if the original value of the tag is requested
			// or if the tag requested is not found in tags
			// or if the tag requested is found in tags but does not yet have a value
			if (useOgVal || (editIdx = tags.indexOf(tagReq)) <= -1 || editIdx >= values.length) {
				// get the tag from the zero level DICOM by name
				reqTag = data.getFromName(tagReq);
				// if it's still null it wasn't found
				if (reqTag == null) {
					er(`Error: ${tagReq} tag not found!!`);
					reqTag = 'null';
				}
				reqTag = reqTag.replace('\u0000', '');
			} else {
				// get the tag from the values array
				reqTag = values[editIdx];
			}
			// replace the request with the tag itself, the quotes are necessary
			str = str.replace('$' + tagReq, `\'${reqTag}\'`);
		}
		// note that eval is used to evaluate user javascript dynamically!
		// direct access to String methods gives users advanced control
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String
		try {
			str = eval(str);
		} catch (ror) {
			er('eval failed for request: ' + str);
			throw err;
		}
		return str;
	}

	errorCheck(tag, value) {
		switch (tag) {
			case 'AcquisitionDate':
			case 'ContentDate':
			case 'InstanceCreationDate':
			case 'PatientBirthDate':
			case 'StudyDate':
				if (typeof value !== 'string') {
					throw new Error(`${tag} ${value}
Dates must be entered as a String in a standard format, ex:'YYYYMMDD'
					`);
				}
				let isYear = (parseInt(value.slice(0, 4)) >= 1900);
				let isMonth = (parseInt(value.slice(4, 6)) <= 12);
				let isDay = (parseInt(value.slice(6, 8)) <= 31);
				if ((!isYear || !isMonth || !isDay)) {
					log(`${tag} ${value}
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
					throw new Error(`${tag} ${value}
Times must be entered as a String in a standard format, ex:'HHMMSS'
					`);
				}
				break;
			default:
		}
	}

	results() {
		let res = '';
		for (let i = 0; i < files.length; i++) {
			res += files[i] + '\n';
			res += ((outPaths[i]) ? outPaths[i] : 'failed') + '\n';
		}
		let resTree = render(outPaths.filter((outPath) => {
				return outPath;
			}), outDir,
			(parent, file, explicit) => {
				return file;
			}
		);
		res += '\nRESULTS TREE:\n\n' + resTree;
	}

	async cleanEmptyFoldersRecursively(folder) {
		if (!(await fs.stat(folder)).isDirectory()) {
			return 1;
		}
		let files = await klaw(folder);
		if (files.length >= 1) {
			for (file in files) {
				let fullPath = folder + '/' + file;
				await cleanEmptyFoldersRecursively(fullPath);
			}
			files = await klaw(folder);
		}
		if (files.length <= 1) {
			if (files[0] == '.DS_Store') {
				await fs.unlink(folder + '/' + files[0]);
			} else if (files.length == 1) {
				return;
			}
			await fs.rmdir(folder);
			log('removed: ', folder);
		}
	}

	// async copyNonDicomFiles() {
	// 	for (let index = 0; index < failed.length; index++) {
	// 		try {
	// 			let i = failed[index];
	// 			let file = files[i];
	// 			let base = path.parse(file).base;
	// 			if (base.match(/dir/i)) {
	// 				log('loading: ' + file);
	// 				let dirs = [];
	// 				let j, tmp;
	// 				for (j = 1; !tmp && i >= j; j++) {
	// 					tmp = path.parse(outPaths[i - j]).dir;
	// 				}
	// 				dirs.push(tmp);
	// 				tmp = '';
	// 				for (j = 1; !tmp && i < files.length - j; j++) {
	// 					tmp = path.parse(outPaths[i + j]).dir;
	// 				}
	// 				dirs.push(tmp);
	// 				log(dirs);
	// 				let outPath = strSim.findBestMatch(path.parse(file).dir.slice(inPath.length), dirs).bestMatch.target + '/' + base;
	// 				log('writing: ' + outPath + '\n');
	// 				await fs.copy(file, outPath);
	// 				outPaths[i] = outPath;
	// 				failed.splice(index, 1);
	// 				index--;
	// 			}
	// 		} catch (ror) {
	// 			er(ror);
	// 		}
	// 	}
	// }

}

module.exports = new AutomaDicom();
