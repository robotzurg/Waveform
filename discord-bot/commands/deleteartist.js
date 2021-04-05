const db = require("../db.js");

module.exports = {
	name: 'deleteartist',
    aliases: ['deleteartist', 'deletea'],
	type: 'Admin',
    description: 'Deletes an artist from the database. [ADMIN/BOT OWNER ONLY]',
    args: true,
    arg_num: 1,
    usage: '<artist>',
	execute(message, args) {
        
        //Auto-adjustment to caps for each word
        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

		if (message.member.hasPermission('ADMINISTRATOR') || message.author.id === '122568101995872256') {
            db.reviewDB.delete(args[0]);
			message.channel.send(`${args[0]} deleted from the database.`);
		} else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};