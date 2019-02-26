module.exports = async function(opt) {
	// opt.v = false; // quieter log
	opt.electron = true;
	await require('./setup/setup.js')(opt);

	async function doAction(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act == 'start') {

		}
	}
	cui.setCustomActions(doAction);

	cui.uiStateChange('main');
	cui.start({
		v: true
	});
}
