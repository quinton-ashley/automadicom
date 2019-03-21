module.exports = async function(arg) {
	// arg.v = false; // quieter log
	await require(arg.__rootDir + '/core/setup.js')(arg);

	const {
		systemPreferences
	} = electron;

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

	systemPreferences.subscribeNotification(
		'AppleInterfaceThemeChangedNotification', themeChange);

	const bootstrapTable = require(__rootDir +
		'/node_modules/bootstrap-table/dist/bootstrap-table.min.js');
	const automadicom = await require(__rootDir + '/core/automadicom.js');

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
			await automadicom.setInput(x);
			await loadFile(0);
		}
		return x;
	}

	cui.setUIOnChange((state, subState, gamepadConnected) => {});

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act.includes('Toggle')) {
			$('#' + ui + 'Toggle').removeClass('enabled');
			$('#' + ui).hide('blind');
			cui.change(act.slice(0, -6));
			$('#' + cui.ui).show('blind');
			$('#' + act).addClass('enabled');
		}
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
		}
		if (act == 'quit') {
			app.exit();
		}
	});

	let flatTags = [];

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
							tag.value += '&quot;' + tag.Value[i] + '&quot;';
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
			flatTags.push(tag);
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

	await automadicom.setup();
	let inFiles = await automadicom.setInput();
	for (let i in inFiles) {
		$('#loadFileSelection').append(pug(`button#inFile${i}.uie ${inFiles[i]}`));
	}
	await loadFile(0);

	async function loadFile(x) {
		let tags = await automadicom.getTags(x);
		flattenTags(tags);

		let $table = $('#tagsTable');
		$table.bootstrapTable({
			data: flatTags
		});
		$('table.table').removeClass('table-bordered');
		$('input.form-control').removeClass('form-control').addClass('p-2');
		$('div.float-left.search').addClass('mt-0');
		$table.bootstrapTable('hideColumn', 'pos');
		$table.bootstrapTable('hideColumn', 'vr');
	}
}
