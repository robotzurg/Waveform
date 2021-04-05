const db = require("../db.js");

module.exports = {
    name: 'removemember',
    type: 'Admin',
    description: 'Remove a member from the genre roulette game. [Admin Only]',
    args: true,
    arg_num: 1,
    usage: '<user>',
	execute(message, args) {
        if (message.member.hasPermission('ADMINISTRATOR')) {
            if (!db.genreRoulette.has(args[0])) return message.channel.send(`${args} is not in the game!`);

            db.genreRoulette.delete(args[0]);
            message.channel.send(`${args} has been removed from the game.`);
        } else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};