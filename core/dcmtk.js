/*
 * dcmtk.js by Quinton Ashley
 * Open Source MIT Licensed
 */

const child = require('child_process').execFile;
const dcm2json = `${__rootDir}/dcmtk/${osType}/dcm2json${((win)?'.exe':'')}`;
const dcmodify = `${__rootDir}/dcmtk/${osType}/dcmodify${((win)?'.exe':'')}`;

const parseJSON = require('json-parse-better-errors');

let dictID;
let dictVR;

class DCMTK {
	constructor() {}

	async getTags(file) {
		return new Promise((resolve, reject) => {
			let str = '';
			let prevData = '';
			let kill = false;
			let finished = false;

			let filterResults = () => {
				if (finished) return;
				let tags;
				if (str.slice(-1) != '}') str += '"}}';
				try {
					tags = parseJSON(str);
				} catch (ror) {
					er(ror);
				}
				for (let id in tags) {
					if (tags[id].InlineBinary) {
						delete tags[id];
					}
				}
				log(tags);
				finished = true;
				resolve(tags);
			};

			let cmd = child(dcm2json, [file, '-fc'], filterResults);

			cmd.stdout.on('data', (data) => {
				if (kill) return;
				data = data.toString();
				if ((prevData + data).match(/InlineBinary/)) {
					str += data;
					str = str.split(/,[^,]*,"InlineBinary/)[0];
					str += '}';
					cmd.kill('SIGINT');
					kill = true;
					filterResults();
				} else {
					str += data;
				}
				prevData = data;
			});
		});
	}

	async modifyTags(file, values) {
		return new Promise((resolve, reject) => {
			let args = [file];
			args.push('--ignore-missing-tags');
			args.push('--ignore-errors');
			for (let tagName in values) {
				args.push('-ma');
				args.push(`${tagName}=${values[tagName]}`);
			}
			log(args);
			let cmd = child(dcmodify, args, () => resolve(file + '.bak'));
		});
	}
}

module.exports = new DCMTK();
