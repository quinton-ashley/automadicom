const CSV = require('csv-string'); // open source csv parser and stringifier
const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
const fs = require('fs'); // built-in node.js file system library
const fsPath = require('fs-path'); // open source high level fs function
const glob = require('glob'); // open source glob capability for node
const mv = require('mv'); // open source mv capability for node
const open = require('open'); // open source web browser URL opener
const path = require('path'); // built-in node.js path library
const process = require('process'); // built-in node.js process library

function automaDICOM() {
	this.in = null;
	this.rules = __dirname + path.sep + 'usr' + path.sep + 'rules.csv';
	this.out = null;
	this.append = __dirname + path.sep + 'usr' + path.sep + 'append.csv';
	this.server = false;
	this.verbose = true;
	this.list = false;
	this.tags = [];
	this.values = [];
	this.newPaths = [];

	this.error = (err) => {
		console.log('ERROR: ' + err);
		process.exit(1);
	}

	this.getSubLevelTag = (tagReq, elements) => {
		switch (tagReq) {
			case 'CodeMeaning':
				return elements.getFromName('ViewCodeSequence')['x00080104'].value[0];
			case 'FrameLaterality':
				return elements.getFromName('SharedFunctionalGroupsSequence')['x00209071'].value[0]['x00209072'].value[0];
			default:
		}
	}

	this.fulfillTagReqs = (str, elements, values) => {
		let match, tagReq, tag;
		let useOgVal = false;
		let editIdx = -1;
		let regex = /\$[\w|\-|_]*/i;
		// loops while a match is found
		while (match = regex.exec(str)) {
			useOgVal = (match[0][1] == '$');
			tagReq = match[0].slice(((useOgVal) ? 2 : 1), match[0].length);
			// if values is not defined or if the requested tag is not found in this.tags
			if (useOgVal || (editIdx = this.tags.indexOf(tagReq)) <= -1) {
				// get the tag from the zero level DICOM by name
				tag = elements.getFromName(tagReq);
				if (tag == null) {
					tag = this.getSubLevelTag(tagReq, elements);
				}
				// if it's still null it wasn't found
				if (tag == null) {
					this.error(tagReq + ' tag not found!!');
				}
			} else {
				// get the tag from the values array
				tag = values[editIdx];
			}
			// replace the request with the tag itself, the quotes are necessary
			str = str.replace('$' + tagReq, `\'${tag}\'`);
		}
		// note that eval is used to evaluate user javascript dynamically!
		// direct access to String methods gives users advanced control
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String
		try {
			str = eval(str);
		} catch (err) {}
		return str;
	}

	this.errorCheck = (tag, value) => {
		switch (tag) {
			case 'AcquisitionDate':
			case 'ContentDate':
			case 'InstanceCreationDate':
			case 'PatientBirthDate':
			case 'StudyDate':
				let isYear = (parseInt(value.slice(0, 4)) >= 1900);
				let isMonth = (parseInt(value.slice(4, 6)) <= 12);
				let isDay = (parseInt(value.slice(6, 8)) <= 31);
				if ((!isYear || !isMonth || !isDay)) {
					this.error(`${tag} ${value}
	Dates must be entered as a Number in the format YYYYMMDD`);
				}
				break;
			case 'AcquisitionTime':
			case 'ContentTime':
			case 'InstanceCreationTime':
			case 'PatientBirthTime':
			case 'StudyTime':
				// check
				break;
			default:
		}
	}

	this.edit = (file, files) => {
		let i = 0;
		// loads the parser and writer from the open source library DWV
		let parser = new dwv.dicom.DicomParser();
		let writer = new dwv.dicom.DicomWriter();
		if (this.verbose) {
			console.log('loading ' + file);
		}
		// parse the array buffer of the file
		parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
		// get the tags
		let elements = parser.getDicomElements();
		if (this.list) {
			console.log(elements.dump());
		}
		// the default rule must be included, it simply copies all other tag's value(s)
		// hard coding this inside this program pervents users from screwing it up
		// also for user convience the action of their rules is always 'replace'
		let rules = {
			default: {
				action: 'copy',
				value: null
			}
		};
		// a seperate copy of the values array must be used for each image
		let values = this.values.slice();
		// rule objects conforms to the format the DICOM writer expects
		this.tags.forEach((tag, i) => {
			values[i] = this.fulfillTagReqs(values[i], elements, values);
			this.errorCheck(tag, values[i]);
			rules[tag] = {
				action: 'replace',
				value: values[i]
			};
		});
		if (this.verbose) {
			values.forEach((value, i) => {
				console.log(`${this.tags[i]} = ${value}`);
			});
		}
		// the rules are applied immediately after they are set
		writer.rules = rules;
		// buffer gets the modified DICOM file
		let buffer = writer.getBuffer(parser.getRawDicomElements());
		// let's decide where to write the file!
		let dir, imgName;
		let newPath = '';
		if (this.out != null) {
			dir = this.out;
			for (i = 0; i < this.append.length - 1; i++) {
				dir += path.sep + this.fulfillTagReqs(this.append[i][0], elements, values);
			}
			imgName = this.fulfillTagReqs(this.append[this.append.length - 1][0], elements, values);
			// at the end of this loop it is assured that a unique file name has been created
			for (i = 0; newPath == '' || this.newPaths.includes(newPath) || fs.existsSync(newPath); i++) {
				newPath = dir + path.sep + `${imgName}_${i.toString()}.dcm`;
				if (newPath == file) {
					break;
				}
			}
		} else {
			// get the directory of the file
			dir = file.slice(0, file.lastIndexOf(path.sep) + 1);
			// prepend anon_ to the file name
			imgName = 'anon_' + file.slice(file.lastIndexOf(path.sep) + 1, file.length);
			newPath = dir + imgName;
		}
		this.newPaths.push(newPath);
		if (this.verbose) {
			console.log('wrote ' + newPath);
		}


		// writeFile can be used asynchronously here, this is advantageous
		// fsPath makes any new directories if necessary
		fsPath.writeFile(newPath, Buffer(new Uint8Array(buffer)), (err) => {
			if (err) throw err;
			if (this.server) {
				// if running in server mode (continuous operation) delete the original file
				fs.unlink(file);
			}
		});
	};

	this.setup = (err, files) => {
		if (err || typeof files == 'undefined' || files.length == 0) {
			console.log('ERROR: invalid path, no files found');
			this.error(err);
		}
		// read the rules file synchronously
		this.rules = fs.readFileSync(this.rules, 'utf8');
		// parse the csv file into arrays we can use
		this.rules = CSV.parse(this.rules, ';');
		this.rules.forEach((rule) => {
			this.tags.push(rule[0]);
			this.values.push(rule[1]);
		});
		if (this.append != null) {
			this.append = fs.readFileSync(this.append, 'utf8');
			this.append = CSV.parse(this.append);
		}

		for (let i = 0, file = ''; i < files.length; i++) {
			file = files[i];
			if (!fs.statSync(file).isDirectory()) {
				if (!/\.\D+/.exec(file)) {
					fs.renameSync(file, file += '.dcm');
				}
				if (file.slice(file.length - 4, file.length) == '.dcm') {
					this.edit(file, files);
				}
			}
		}
	}

	this.run = () => {
		console.log('');
		if (this.in != null && this.rules != null) {
			// if the input path is a directory send it straight to the setup function
			// else glob for leaves of the fs
			if (!fs.statSync(this.in).isDirectory()) {
				this.setup(null, [this.in]);
			} else {
				glob(this.in + path.sep + '**' + path.sep + '*', this.setup);
			}
		} else {
			this.error('required input and rules paths not entered');
		}
	}
}

module.exports = new automaDICOM();
