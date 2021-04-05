const db = require("../db.js");
const { genreList } = require('../arrays.json');

module.exports = {
    name: 'addmember',
    type: 'Admin',
    description: 'Adds a member to the genre roulette game! [Admin Only]',
    args: true,
    arg_num: 1,
    usage: '<user>',
	execute(message, args) {
        if (message.member.hasPermission('ADMINISTRATOR')) {
            const genrePick = genreList[Math.floor(Math.random() * genreList.length)];
            const userObj = {
                genre: genrePick,
                status: 'alive',
            };
            db.genreRoulette.set(`${args}`, userObj);
            message.channel.send(`${args}'s genre has been set to ${db.genreRoulette.get(args, `genre`)}.`);
            message.channel.send(`${args}'s status has been set to ${db.genreRoulette.get(args, `status`)}.`);
         } else { return message.reply('You don\'t have the perms to use this command!'); }
	},
};