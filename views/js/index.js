module.exports = async function(arg) {
	// arg.v = false; // quieter log
	await require(arg.__rootDir + '/core/setup.js')(arg);

	const {
		systemPreferences
	} = electron;
	const bootstrapTable = require(__rootDir +
		'/node_modules/bootstrap-table/dist/bootstrap-table.min.js');
	const automadicom = await require(__rootDir + '/core/automadicom.js');
	const dwv = require('dwv');

	let prefsMan = require(__rootDir + '/prefs/prefsManager.js');
	prefsMan.prefsPath = usrDir + '/_usr/prefs.json';
	global.prefs = await prefsMan.load();
	log(prefs);

	let dcmFilePaths;
	let dcmIndex;

	let dcmFiles = [];
	let studies = {};

	let editor = {};

	function setTheme(theme) {
		prefs.ui.theme = theme;
		if (theme == 'dark') {
			$('body').removeClass('light');
			$('body').addClass('dark');
		} else {
			$('body').addClass('light');
			$('body').removeClass('dark');
		}
	}
	if (mac) {
		systemPreferences.subscribeNotification(
			'AppleInterfaceThemeChangedNotification', setTheme);
		setTheme(systemPreferences.isDarkMode() ? 'dark' : 'light');
	} else {
		setTheme(prefs.ui.theme);
	}

	async function select(asg, type) {
		let x = dialog.select({
			type: type
		});
		if (typeof x == 'undefined') return;
		arg[asg] = x;
		if (typeof x != 'string') x = x[0];
		$('#' + asg + 'Path').val(x);
		if (asg == 'input') await selectInput(x);
		if (asg == 'output') await automadicom.setOutputDir(x);
		return x;
	}

	cui.setUIOnChange((state, subState, gamepadConnected) => {
		if (state.includes('Tab')) {
			$('#' + cui.ui + 'Toggle').addClass('disabled');
			$('#' + cui.ui).hide();
			$('#' + state).show();
			$('#' + state + 'Toggle').removeClass('disabled');
		}
		if (cui.ui == 'rightTab') {
			editConfig(editor.configName);
		}
	});

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act == 'input') {
			await select('input', 'dir');
		} else if (act == 'start') {
			log(arg);
			await select('output', 'dir');
			automadicom.start();
		} else if (act == 'back') {
			cui.change('leftTab');
		} else if (act == 'quit') {
			app.exit();
		} else if (act.includes('inFile')) {
			await loadFile(Number(act.slice(-1)));
		} else if (act.includes('study_')) {
			await loadStudy(act.slice(6).replace(/_/g, '.'));
		} else if (act.includes('____checkbox')) {
			let boxChecked = $('#' + act + ' input').is(':checked');
			act = act.split('____checkbox')[0];
			let configEnabled = automadicom.isConfigEnabled(act);
			if (act != 'New_Custom_Config' && boxChecked != configEnabled) {
				automadicom.toggleConfig(act, boxChecked);
			} else {
				log('editing config: ' + act);
				$('#loader').show();
				await delay(100);
				await loadConfig(act);
				cui.change('rightTab');
				$('#loader').hide();
			}
		}
	});

	cui.setResize(() => {
		$('#studies').height($(window).height() - $('#options').height() - 50);
	});

	async function editConfig(configName) {
		let config = automadicom.configs[configName] || {};
		let rules = config.rules || {};
		let $table = $('#editorTable');
		let data = editor.data;
		log(data);
		for (let row of data) {
			if (row.value === '' || row.value === null) {
				delete rules[row.tag];
			} else {
				rules[row.tag] = row.value;
			}
		}
		if (!config.rules) {
			log('new');
			configName = $('#configName').prop('value').replace(/ /g, '_');
			config.rules = rules;
			automadicom.configs[configName] = config;
			await loadOptions();
		}
		log(automadicom.configs[configName]);
		await automadicom.saveConfigFile(configName);
	}

	async function loadConfig(configName) {
		editor.configName = configName;
		$('#configName').prop('value', configName.replace(/_/g, ' '));
		let config = automadicom.configs[configName] || {};
		let rules = config.rules || {};
		let data = [];
		for (let tagID in automadicom.dictID) {
			let tagName = automadicom.dictID[tagID];
			if (rules[tagName] === undefined) {
				rules[tagName] = null;
			}
		}
		for (let tagName in rules) {
			data.push({
				tag: tagName,
				value: rules[tagName]
			});
		}
		log(data);
		editor.data = data;
		let editFunc = function() {
			$('#editor input').keyup(function(e) {
				let val = $(this).prop('value');
				log(val);
				let name = $(this).parent().prev().html;
				log(name);
				let row = data.find(x => x.tag === name) || {};
				row.value = val;
				log(row);
			});
		};
		let $table = $('#editorTable');
		$table.bootstrapTable();
		$table.bootstrapTable('showLoading');
		$table.bootstrapTable('load', data);
		$table.bootstrapTable('hideLoading');
		$table.bootstrapTable('onSearch', editFunc);
		editFunc();
	}

	async function loadOptions() {
		let $checkboxes = $('#checkboxes');
		$checkboxes.empty();
		let checkboxTemplate = await fs.readFile(__rootDir +
			'/views/pug/checkbox.pug');
		for (let configName in automadicom.configs) {
			$checkboxes.append(pug(checkboxTemplate, {
				id: configName
			}));
		}
		cui.addView('checkboxes');
		cui.resize();
	}

	async function selectInput(inDir) {
		dcmFilePaths = await automadicom.setInput(inDir);
		dcmIndex = 0;
		dcmFiles = [];
		let tags = [];
		for (let file of dcmFilePaths) {
			tags = await automadicom.getTags(file);
			dcmFiles.push(tags);
		}
		createStudiesTable(dcmFilePaths);
		cui.addView('studiesTable');
		await loadFile(0, true);
	}

	function getTagValue(tags, name) {
		return (tags.find(x => x.name === name) || {}).value || 'NOT FOUND';
	}

	function createStudiesTable(files) {
		let rowInfo = [];
		studies = {};
		for (let i in files) {
			let tags = dcmFiles[i];
			let info = {
				Index: i
			};
			let uid = getTagValue(tags, 'StudyInstanceUID');
			info.StudyInstanceUID = uid;
			if (!rowInfo.find(x => x.StudyInstanceUID === uid)) {
				let names = [
					'PatientName', 'PatientID', 'StudyDate',
					'Modality', 'Laterality'
				];
				for (let name of names) {
					info[name] = getTagValue(tags, name);
				}
				rowInfo.push(info);
			}
			studies[uid] = studies[uid] || [];
			studies[uid].push(i);
		}
		log(studies);

		let $table = $('#studiesTable');
		$table.bootstrapTable();
		$table.bootstrapTable('load', rowInfo);
		$('div.search input').eq(0).prop('placeholder', 'Search Studies');

		let $rows = $('#studiesTable tbody tr');
		$rows.addClass('uie table');
		$rows.each(function(i) {
			$(this).prop('id', 'study_' +
				rowInfo[i].StudyInstanceUID.replace(/\./g, '_'));
		});
		// base function to get elements
		dwv.gui.getElement = dwv.gui.base.getElement;
		dwv.gui.displayProgress = function(percent) {};

		loadStudy(rowInfo[0].StudyInstanceUID);
	}

	function loadStudy(study) {
		$('#studiesTable tbody tr').removeClass('selected');
		$('#study_' + study.replace(/\./g, '_')).addClass('cursor selected');
		$('#images').empty();
		for (let i of studies[study]) {
			$('#images').append(pug(`
.col-12: .row
	#dwv${i}.col-11: .layerContainer: canvas#dwvCanvas${i}.imageLayer
	p.col-6 ${getTagValue(dcmFiles[i], 'SeriesDescription')}
	button.col-6#inFile${i}.uie.link Preview Edits
`));
			let app = new dwv.App();
			app.init({
				containerDivId: 'dwv' + i,
				tools: ['Scroll']
			});
			app.loadURLs([dcmFilePaths[i]]);
		}
		cui.addView('images');
	}

	async function loadFile(inputFileIndex, noTabSwitch) {
		$('#inFile' + dcmIndex).addClass('disabled');
		dcmIndex = inputFileIndex;
		$('#inFile' + dcmIndex).removeClass('disabled');
		log(dcmIndex);
		tags = dcmFiles[dcmIndex];
		tags = await automadicom.previewChanges(dcmIndex, tags);

		let $table = $('#tagsTable');
		$table.bootstrapTable();
		$table.bootstrapTable('showLoading');
		$table.bootstrapTable('load', tags);
		$('table.table').removeClass('table-bordered');
		$('input.form-control').removeClass('form-control').addClass('p-2');
		$('div.float-left.search').addClass('mt-0');
		$table.bootstrapTable('hideColumn', 'pos');
		$table.bootstrapTable('hideColumn', 'vr');
		$table.bootstrapTable('hideLoading');
		if (!noTabSwitch) {
			cui.change('midTab');
		}
	}

	cui.change('leftTab');
	cui.start({
		v: true
	});

	$('#loader').show();
	await automadicom.test();
	await automadicom.setup();
	await loadOptions();
	await selectInput();
	$('#loader').hide();

	// function createStudiesTable(files) {
	// 	let res = {};
	// 	for (let file of files) {
	// 		file = path.relative(automadicom.getInputDir(), file);
	// 		file = path.nx(file);
	// 		file.split('/').reduce((o, k) => o[k] = o[k] || {}, res);
	// 	}
	// 	log(res);
	// 	$('#loaddcmFilePaths').empty();
	// 	_createStudiesTable(res, 0);
	// }
	//
	// function _createStudiesTable(files, level) {
	// 	for (let i in files) {
	// 		if ($.isEmptyObject(files[i])) {
	// 			let x = pug(`#inFile${dcmIndex++}.uie.link.disabled ` +
	// 				'/ '.repeat(level) + i);
	// 			$('#loaddcmFilePaths').append(x);
	// 		} else {
	// 			let x = pug('div ' + '/ '.repeat(level) + i);
	// 			$('#loaddcmFilePaths').append(x);
	// 			_createStudiesTable(files[i], level + 1);
	// 		}
	// 		if (i >= 20) {
	// 			$('#loaddcmFilePaths').append(pug('p ...'));
	// 			break;
	// 		}
	// 	}
	// }

	// $(this).parent().find('input').is(':checked')
}
