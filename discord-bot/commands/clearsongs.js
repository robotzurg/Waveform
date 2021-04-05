const db = require("../db.js");

module.exports = {
	name: 'clearsongs',
	type: 'Admin',
    description: 'Clear all Friday Listening Songs from the playlist. [ADMIN ONLY]',
	execute(message) {
		if (message.member.hasPermission('ADMINISTRATOR') || (message.author.id === '122568101995872256')) {
            db.friList.clear();
			message.channel.send('Friday Playlist cleared.');
		} else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};