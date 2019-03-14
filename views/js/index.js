module.exports = async function(arg) {
	// arg.v = false; // quieter log
	await require(arg.__rootDir + '/core/setup.js')(arg);

	const {
		systemPreferences
	} = electron;

	systemPreferences.subscribeNotification(
		'AppleInterfaceThemeChangedNotification',
		function theThemeHasChanged() {
			if (systemPreferences.isDarkMode()) {
				$('body').removeClass('light');
				$('body').addClass('dark');
			} else {
				$('body').addClass('light');
				$('body').removeClass('dark');
			}
		}
	)

	const bootstrapTable = require(__rootDir +
		'/node_modules/bootstrap-table/dist/bootstrap-table.min.js');
	// const bootstrapTable = require('bootstrap-table');
	const automadicom = await require(__rootDir + '/core/automadicom.js');

	async function select(asg, type) {
		let x = dialog.select({
			type: type
		});
		arg[asg] = x;
		if (typeof x != 'string') {
			x = x[0];
		}
		$('#' + asg + 'Path').val(x);
		if (asg == 'input') await selectInput(x);
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
		if (act == 'inFile') {
			await select('input', 'file');
		} else if (act == 'inFiles') {
			await select('input', 'files');
		} else if (act == 'inDir') {
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

	function flattenTags(meta, level, idBase) {
		let flatTags = [];
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
					if (typeof tag.Value[0] == 'number') {
						tag.value = tag.Value[0];
					} else if (typeof tag.Value[0] == 'string') {
						tag.value = '&quot;' + tag.Value[0] + '&quot;';
					}
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
			delete tag.Value;
			flatTags.push(tag);
			if (sub) {
				flatTags.concat(flattenTags(sub, level + 1, tag.pos));
			}
			i++;
		}
		return flatTags;
	}

	cui.change('leftTab');
	cui.start({
		v: true
	});

	await automadicom.setup();

	async function selectInput(x) {
		let tags = await automadicom.getTags(x);
		let flatTags = [];
		flatTags = flattenTags(tags);

		$('#tagsTable').bootstrapTable({
			data: flatTags
		});
		$('table.table').removeClass('table-bordered');
		$('input.form-control').removeClass('form-control').addClass('p-2');
		$('div.float-left.search').addClass('mt-0');
	}
}
