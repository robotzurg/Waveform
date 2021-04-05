const db = require("../db.js");

module.exports = {
	name: 'deletesong',
    aliases: ['deletesong', 'deletes'],
	type: 'Admin',
    description: 'Deletes a song from the database. [ADMIN/BOT OWNER ONLY]',
    args: true,
    arg_num: 2,
    usage: '<artist> | <song>',
	execute(message, args) {
        //Auto-adjustment to caps for each word
        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        args[1] = args[1].split(' ');
        args[1] = args[1].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[1] = args[1].join(' ');

        //Split up the artists into an array
        let artistArray;

        if (!args[0].includes(',')) {
            artistArray = args[0].split(' & ');
        } else {
            artistArray = args[0].split(', ');
            if (artistArray[artistArray.length - 1].includes('&')) {
                let iter2 = artistArray.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistArray.push(a));
                console.log(iter2);
            }
        }

		if (message.member.hasPermission('ADMINISTRATOR') || message.author.id === '122568101995872256') {
            for (let i = 0; i < artistArray.length; i++) {
                const artistObj = db.reviewDB.get(artistArray[i]);
                if (artistObj === undefined) return message.channel.send('Artist not found.');
                delete artistObj[args[1]];
                db.reviewDB.set(artistArray[i], artistObj);
            }

			message.channel.send(`${args[0]} - ${args[1]} deleted from the database.`);
		} else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};