const db = require("../db.js");
const { genreList } = require('../arrays.json');

module.exports = {
	name: 'reset',
	type: 'Admin',
    description: 'Reset the game to base level with all current players. [ADMIN ONLY]',
	execute(message) {
		if (message.member.hasPermission('ADMINISTRATOR') || message.author.id === '122568101995872256') {
		
			db.genreRoulette.forEach((prop, key) => {
				const genrePick = genreList[Math.floor(Math.random() * genreList.length)];
				db.genreRoulette.set(key, { genre: genrePick, status: 'alive' });
			});

			const friIDmsg = db.friID.get('friID');
			const channeltoSearch = message.guild.channels.cache.find(ch => ch.name === 'friday-playlist');
			(channeltoSearch.messages.fetch(friIDmsg)).then((msg) => {
				msg.reactions.removeAll();
			});

			message.channel.send('Game reset.');

		} else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};