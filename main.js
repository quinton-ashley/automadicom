const CSV = require('csv-string'); // open source csv parser and stringifier
const dwv = require('dwv'); // open source DICOM parser, viewer, and writer
var exit = require('node-cleanup'); // open source graceful exit
const fs = require('fs'); // node.js file system library
const fsPath = require('fs-path');
const glob = require('glob'); // open source glob capability for node
const mv = require('mv'); // open source mv capability for node
const open = require('open');
const process = require('process'); // node.js process library

var _in = null;
var _rules = null;
var _out = null;
var _append = null;
var _server = false;
var _tags = [];
var _values = [];
var _newPaths = [];

var help = (err) => {
	console.log(err);
	process.exit(1);
}

var findSubLevelTag = (tagReq, elements) => {
	switch (tagReq) {
		case 'CodeMeaning':
			return elements.getFromName('ViewCodeSequence')['x00080104'].value[0];
		case 'FrameLaterality':
			return elements.getFromName('SharedFunctionalGroupsSequence')['x00209071'].value[0]['x00209072'].value[0][0];
		default:
			console.log('ERROR: ' + tagReq + ' tag not found!!');
			process.exit(1);
	}
}

var fulfillTagReqs = (str, elements, values) => {
	let match, tagReq, tag;
	let editIdx = -1;
	let regex = /\$[\w|\-|_]*/i;
	// loops while a match is found
	while (match = regex.exec(str)) {
		tagReq = match[0].slice(1, match[0].length);
		// if values is not defined or if the requested tag is not found in _tags
		if (typeof values === 'undefined' ||
			(editIdx = _tags.indexOf(tagReq)) <= -1) {
			// get the tag from the zero level DICOM by name
			tag = elements.getFromName(tagReq);
			if (tag == null) {
				tag = findSubLevelTag(tagReq, elements);
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

var edit = (file, files) => {
	let i = 0;
	// loads the parser and writer from the open source library DWV
	let parser = new dwv.dicom.DicomParser();
	let writer = new dwv.dicom.DicomWriter();
	// parse the array buffer of the file
	parser.parse(new Uint8Array(fs.readFileSync(file)).buffer);
	// get the tags
	let elements = parser.getDicomElements();
	// the default rule must be included, it simply copies all other tag's value(s)
	// hard coding this inside this program pervents users from screwing it up
	// also for user convience the action of their rules is always 'replace'
	let rules = {
		default: {
			action: 'copy',
			value: null
		}
	};
	let values = _values.slice();
	// rule objects conforms to the format the DICOM writer expects
	_tags.forEach((tag, i) => {
		values[i] = fulfillTagReqs(values[i], elements);
		rules[tag] = {
			action: 'replace',
			value: values[i]
		};
	});
	// the rules are applied immediately after they are set
	writer.rules = rules;
	// buffer gets the modified DICOM file
	let buffer = writer.getBuffer(parser.getRawDicomElements());
	// let's decide where to write the file!
	let dir, imgName;
	let append = '';
	let newPath = '';
	if (_out != null) {
		dir = _out;
		console.log(values);
		for (i = 0; i < _append.length - 1; i++) {
			append += '/' + fulfillTagReqs(_append[i][0], elements, values);
		}
		imgName = fulfillTagReqs(_append[_append.length - 1][0], elements, values);
		// at the end of this loop it is assured that a unique file name has been created
		for (i = 0; newPath == '' || _newPaths.includes(newPath) || fs.existsSync(newPath); i++) {
			newPath = `${dir + append}/${imgName}_${i.toString()}.dcm`;
			if (newPath == file) {
				break;
			}
		}
	} else {
		// get the directory of the file
		dir = file.slice(0, file.lastIndexOf('/') + 1);
		// prepend anon_ to the file name
		imgName = 'anon_' + file.slice(file.lastIndexOf('/') + 1, file.length);
		newPath = dir + imgName;
	}
	_newPaths.push(newPath);
	console.log(newPath);


	// writeFile can be used asynchronously here, this is advantageous
	// fsPath makes any new directories if necessary
	//	fsPath.writeFile(newPath, Buffer(new Uint8Array(buffer)), (err) => {
	//		if (err) throw err;
	//		if (_server) {
	//			// if running in server mode (continuous operation) delete the original file
	//			fs.unlink(file);
	//		}
	//	});
};

var setup = (err, files) => {
	if (err || typeof files == 'undefined' || files.length == 0) {
		console.log('invalid path, no files found');
		console.log(err);
		process.exit(1);
	}
	// read the rules file synchronously
	_rules = fs.readFileSync(_rules, 'utf8');
	// parse the csv file into arrays we can use
	_rules = CSV.parse(_rules, ';');
	_rules.forEach((rule) => {
		_tags.push(rule[0]);
		_values.push(rule[1]);
	});
	if (_append != null) {
		_append = fs.readFileSync(_append, 'utf8');
		_append = CSV.parse(_append);
	}

	for (let i = 0, file = ''; i < files.length; i++) {
		file = files[i];
		if (!fs.statSync(file).isDirectory()) {
			if (!file.includes('.')) {
				fs.renameSync(file, file += '.dcm');
			}
			if (file.slice(file.length - 4, file.length) == '.dcm') {
				edit(file, files);
			}
		}
	}
}


if (process.argv.length >= 5) {
	_out = process.argv[4].toString(); // output path is arg 4
}
if (process.argv.length >= 6) {
	_append = process.argv[5].toString(); // append path is arg 5
}
if (process.argv.length >= 4) {
	_in = process.argv[2].toString(); // input path is arg 2
	_rules = process.argv[3].toString(); // rules path is arg 3
	if (_in.includes('.dcm')) {
		anonymize(null, [_in]);
	} else {
		glob(_in + '/**/*', setup);
	}
} else {
	help('input and rules paths not entered');
}

// Notes:
// error check for StudyDate and StudyTime

// graceful exit with node-cleanup
exit((exitCode, signal) => {});
