module.exports = async function(arg) {
	// arg.v = false; // quieter log
	await require(arg.__rootDir + '/core/setup.js')(arg);

	const {
		systemPreferences
	} = electron;
	const bootstrapTable = require(__rootDir +
		'/node_modules/bootstrap-table/dist/bootstrap-table.min.js');
	const automadicom = await require(__rootDir + '/core/automadicom.js');

	let inFiles;
	let infidx;

	function themeChange(darkMode) {
		darkMode = darkMode || systemPreferences.isDarkMode();
		if (darkMode) {
			$('body').removeClass('light');
			$('body').addClass('dark');
		} else {
			$('body').addClass('light');
			$('body').removeClass('dark');
		}
	}
	if (mac) {
		systemPreferences.subscribeNotification(
			'AppleInterfaceThemeChangedNotification', themeChange);
	}

	async function select(asg, type) {
		let x = dialog.select({
			type: type
		});
		if (typeof x == 'undefined') return;
		arg[asg] = x;
		if (typeof x != 'string') {
			x = x[0];
		}
		$('#' + asg + 'Path').val(x);
		if (asg == 'input') {
			await selectInput(x);
		}
		return x;
	}

	cui.setUIOnChange((state, subState, gamepadConnected) => {
		if (state.includes('Tab')) {
			$('#' + cui.ui + 'Toggle').addClass('disabled');
			$('#' + cui.ui).hide();
			$('#' + state).show();
			$('#' + state + 'Toggle').removeClass('disabled');
		}
	});

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act == 'input') {
			await select('input', 'dir');
		} else if (act == 'rules') {
			await select('rules', 'file');
		} else if (act == 'append') {
			await select('append', 'file');
		} else if (act == 'output') {
			await select('output', 'dir');
		} else if (act == 'start') {
			log(arg);
			automadicom.start();
		} else if (act == 'back') {
			cui.change('leftTab');
		}
		if (act == 'quit') {
			app.exit();
		}
		if (act.includes('inFile')) {
			await loadFile(Number(act.slice(-1)));
		}
	});

	let tags = [];

	// flatten tag object to conform to a single level for displaying
	// tag data in the tag editor table
	function flattenTags(meta, level, idBase) {
		if (!level) level = 0;
		if (!idBase) idBase = '';
		let i = 0;
		for (let id in meta) {
			let tag = meta[id];
			if (tag.id) {
				continue;
			}
			tag.name = automadicom.dictID[id] || 'UnknownTagName';
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
				flattenTags(sub, level + 1, tag.pos);
			}
			i++;
		}
	}

	cui.change('leftTab');
	cui.start({
		v: true
	});

	let tagsArr = [];

	await automadicom.setup();
	await selectInput();

	async function selectInput(inDir) {
		inFiles = await automadicom.setInput(inDir);
		infidx = 0;

		for (let file of inFiles) {
			tags = [];
			let meta = await automadicom.getTags(file);
			flattenTags(meta);
			tagsArr.push(tags);
		}

		printPaths(inFiles);
		cui.addView('loadInFiles');
		await loadFile(0, true);
	}

	function getTag(name) {
		return (tags.find(x => x.name === name) || {}).value || name;
	}

	function printPaths(files, level) {
		level = level || 0;
		for (let i in files) {
			tags = tagsArr[i];
			let elem = `#inFile${infidx++}.uie.link.disabled `;
			elem += '/ '.repeat(level);
			let names = ['PatientName', 'PatientID', 'StudyDate', 'Modality', 'Laterality'];
			for (let name of names) {
				elem += getTag(name) + ' ';
			}
			elem = pug(elem);
			$('#loadInFiles').append(elem);

			if (i >= 20) {
				$('#loadInFiles').append(pug('p ...'));
				break;
			}
		}
	}

	async function loadFile(inputFileIndex, noTabSwitch) {
		$('#inFile' + infidx).addClass('disabled');
		$('#inFile' + inputFileIndex).removeClass('disabled');
		infidx = inputFileIndex;
		log(infidx);
		tags = tagsArr[infidx];

		let $table = $('#tagsTable');
		$table.bootstrapTable();
		$table.bootstrapTable('load', tags);
		$('table.table').removeClass('table-bordered');
		$('input.form-control').removeClass('form-control').addClass('p-2');
		$('div.float-left.search').addClass('mt-0');
		$table.bootstrapTable('hideColumn', 'pos');
		$table.bootstrapTable('hideColumn', 'vr');
		if (!noTabSwitch) {
			cui.change('midTab');
		}
	}

	// function printPaths(files) {
	// 	let res = {};
	// 	for (let file of files) {
	// 		file = path.relative(automadicom.getInputDir(), file);
	// 		file = path.nx(file);
	// 		file.split('/').reduce((o, k) => o[k] = o[k] || {}, res);
	// 	}
	// 	log(res);
	// 	$('#loadInFiles').empty();
	// 	_printPaths(res, 0);
	// }
	//
	// function _printPaths(files, level) {
	// 	for (let i in files) {
	// 		if ($.isEmptyObject(files[i])) {
	// 			let x = pug(`#inFile${infidx++}.uie.link.disabled ` + '/ '.repeat(level) + i);
	// 			$('#loadInFiles').append(x);
	// 		} else {
	// 			let x = pug('div ' + '/ '.repeat(level) + i);
	// 			$('#loadInFiles').append(x);
	// 			_printPaths(files[i], level + 1);
	// 		}
	// 		if (i >= 20) {
	// 			$('#loadInFiles').append(pug('p ...'));
	// 			break;
	// 		}
	// 	}
	// }

	// $(this).parent().find('input').is(':checked')
}
