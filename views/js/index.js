module.exports = async function(opt) {
	// opt.v = false; // quieter log
	opt.electron = true;
	await require(opt.__rootDir + '/core/setup.js')(opt);

	function select(asg, type) {
		let x = dialog.select({
			type: type
		});
		opt[asg] = x;
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
			log(opt);
			await require(__rootDir + '/core/automadicom.js')(opt);
		}
		if (act == 'quit') {
			app.exit();
		}
	});

	cui.change('main');
	cui.start({
		v: true
	});
}
