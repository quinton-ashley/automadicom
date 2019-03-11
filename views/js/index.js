module.exports = async function(opt) {
	if (typeof opt == 'string') {
		opt = JSON.parse(opt.replace(/&quot;/g, '"'));
	}
	// opt.v = false; // quieter log
	await require(opt.__rootDir + '/core/setup.js')(opt);

	const automadicom = await require(__rootDir + '/core/automadicom.js');

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
	log(tags);
	// let tagFormFile = __rootDir + '/views/pug/tagForm.pug';
	// tagFormFile = await fs.readFile(tagFormFile, 'utf8');
	// for (let tag of tags) {
	// 	$('#tags').append(pug(tagFormFile, {
	// 		tags: tags
	// 	}));
	// }
}
