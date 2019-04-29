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

	let inFiles;
	let infidx;

	let tags = [];
	let tagsArr = [];
	let filesInfo = [];
	let studies = {};

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
		} else {
			automadicom.toggleConfig(act, $('#' + act + ' input').is(':checked'));
		}
	});

	async function loadOptions() {
		let configs = automadicom.getConfigs();
		let $checkboxes = $('#checkboxes');
		let checkboxTemplate = await fs.readFile(__rootDir +
			'/views/pug/checkbox.pug');
		for (let configName in configs) {
			$checkboxes.append(pug(checkboxTemplate, {
				id: configName
			}));
		}
		cui.addView('checkboxes');
	}

	async function selectInput(inDir) {
		inFiles = await automadicom.setInput(inDir);
		infidx = 0;
		tagsArr = [];
		for (let file of inFiles) {
			tags = await automadicom.getTags(file);
			tagsArr.push(tags);
		}
		printPaths(inFiles);
		cui.addView('inputFilesTable');
		await loadFile(0, true);
	}

	function getTagValue(name) {
		return (tags.find(x => x.name === name) || {}).value || 'NOT FOUND';
	}

	function printPaths(files) {
		filesInfo = [];
		studies = {};
		for (let i in files) {
			tags = tagsArr[i];
			let info = {
				Index: i
			};
			let uid = getTagValue('StudyInstanceUID');
			info.StudyInstanceUID = uid;
			if (!filesInfo.find(x => x.StudyInstanceUID === uid)) {
				let names = ['PatientName', 'PatientID', 'StudyDate', 'Modality', 'Laterality'];
				for (let name of names) {
					info[name] = getTagValue(name);
				}
				filesInfo.push(info);
			}
			studies[uid] = studies[uid] || [];
			studies[uid].push(i);
		}
		log(studies);

		let $table = $('#inputFilesTable');
		$table.bootstrapTable();
		$table.bootstrapTable('load', filesInfo);
		$('div.search input').eq(0).prop('placeholder', 'Search Studies');

		let $rows = $('#inputFilesTable tbody tr');
		$rows.addClass('uie table');
		$rows.each(function(i) {
			$(this).prop('id', 'study_' + filesInfo[i].StudyInstanceUID.replace(/\./g, '_'));
		});
		// base function to get elements
		dwv.gui.getElement = dwv.gui.base.getElement;
		dwv.gui.displayProgress = function(percent) {};

		loadStudy(filesInfo[0].StudyInstanceUID);
	}

	function loadStudy(study) {
		$('#images').empty();
		for (let i of studies[study]) {
			$('#images').append(pug(`
.col-12: .row
	#dwv${i}.col-11: .layerContainer: canvas#dwvCanvas${i}.imageLayer
	p.col-6 Image ${i}
	button.col-6#inFile${i}.uie.link View Tags
`));
			let app = new dwv.App();
			app.init({
				containerDivId: 'dwv' + i,
				tools: ['Scroll']
			});
			app.loadURLs([inFiles[i]]);
		}
		$('#images').append(pug(`
.col-12.p-5
.col-12.p-5
`));
		cui.addView('images');
	}

	async function loadFile(inputFileIndex, noTabSwitch) {
		$('#inFile' + infidx).addClass('disabled');
		$('#inFile' + inputFileIndex).removeClass('disabled');
		infidx = inputFileIndex;
		log(infidx);
		tags = tagsArr[infidx];
		tags = await automadicom.previewChanges(infidx, tags);

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

	cui.change('leftTab');
	cui.start({
		v: true
	});

	await automadicom.test();
	await automadicom.setup();
	await loadOptions();
	await selectInput();

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
