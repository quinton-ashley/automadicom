/*
 * dcmtk.js by Quinton Ashley
 * Open Source MIT Licensed
 */

const child = require('child_process').execFile;
const parseJSON = require('json-parse-better-errors');

let dictID;
let dictVR;
let cwd;
let dcm2json;
let dcmodify;

class DCMTK {
	constructor() {}

	async setup(usrDir) {
		let dcmtk = __rootDir + '/dcmtk/' + osType;
		cwd = usrDir + '/dcmtk/' + osType;
		let ext = ((win) ? '.exe' : '');
		dcm2json = cwd + '/dcm2json' + ext;
		dcmodify = cwd + '/dcmodify' + ext;
		if (!(await fs.exists(cwd))) {
			if (win) {
				await fs.copy(dcmtk, cwd);
			} else {
				await fs.copy(dcmtk + '/dcm2json', dcm2json);
				await fs.copy(dcmtk + '/dcmodify', dcmodify);
				await fs.copy(dcmtk + '/dicom.dic',
					'/usr/local/Cellar/dcmtk/3.6.4/share/dcmtk/dicom.dic');
				await spawn('chmod', ['+x', dcm2json]);
				await spawn('chmod', ['+x', dcmodify]);
			}
		}
	}

	async getTags(file) {
		return new Promise((resolve, reject) => {
			let str = '';
			let prevData = '';
			let kill = false;
			let finished = false;

			let filterResults = (error, stdout, stderr) => {
				if (finished) return;
				if (error || !str) {
					er(error);
					resolve(null);
					return;
				}
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
			let cmd = child(dcmodify, args,
				(error, stdout, stderr) => resolve(file + '.bak'));
		});
	}
}

module.exports = new DCMTK();
