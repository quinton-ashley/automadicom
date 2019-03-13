module.exports = async function(arg) {
	if (typeof arg == 'string') {
		arg = JSON.parse(arg.replace(/&quot;/g, '"'));
	}
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

	function select(asg, type) {
		let x = dialog.select({
			type: type
		});
		arg[asg] = x;
		if (typeof x != 'string') {
			x = x[0];
		}
		$('#' + asg + 'Path').val(x);
		return x;
	}

	cui.setUIOnChange((state, subState, gamepadConnected) => {});

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act == 'in') {
			$('#inputOptions').show('blind');
		} else if (act == 'inFile') {
			select('input', 'dir');
		} else if (act == 'inFiles') {
			select('input', 'files');
			$('#inputOptions').hide('blind');
		} else if (act == 'inDir') {
			select('input', 'dir');
		} else if (act == 'rules') {
			select('rules', 'file');
		} else if (act == 'append') {
			select('append', 'file');
		} else if (act == 'out') {
			select('output', 'dir');
		} else if (act == 'start') {
			log(arg);
			automadicom.start();
		}
		if (act == 'quit') {
			app.exit();
		}
	});

	cui.change('main');
	cui.start({
		v: true
	});

	await automadicom.setup();
	let tags = await automadicom.getTags(4);
	let flatTags = [];

	function tagIDToJSVariable(id) {
		return 'x' + id.substr(0, 4) + '_' + id.substr(4, 8);
	}

	function flattenTags(meta, level) {
		for (let id in meta) {
			let tag = meta[id];
			if (tag.id) {
				continue;
			}
			tag.name = '--'.repeat(level);
			tag.name += automadicom.dictID[id] || 'UnknownTagName';
			tag.id = tagIDToJSVariable(id);
			if (!tag.Value) {
				tag.value = '';
				delete tag.Value;
				continue;
			}
			let sub;
			if (typeof tag.Value[0] != 'object') {
				if (tag.Value.length == 1 &&
					typeof tag.Value[0] != 'number') {
					tag.value = tag.Value[0];
				} else {
					tag.value = tag.Value.toString();
				}
			} else if (tag.Value[0].Alphabetic) {
				tag.value = tag.Value[0].Alphabetic;
			} else {
				tag.value = [];
				for (let id1 in tag.Value[0]) {
					tag.value.push(tagIDToJSVariable(id1));
				}
				tag.value = tag.value.toString().replace(/"/g, '');
				sub = tag.Value[0];
			}
			delete tag.Value;
			flatTags.push(tag);
			if (sub) {
				flattenTags(sub, level + 1);
			}
		}
	}

	flattenTags(tags, 0);

	$('#tagsTable').bootstrapTable({
		data: flatTags
	});
}
