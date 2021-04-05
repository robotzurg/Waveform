const db = require('../db.js');

module.exports = {
	name: 'putinstar',
    aliases: ['p', 'putinstar'],
	type: 'Review DB',
	description: 'Put star into list manually',
    args: true,
    arg_num: 2,
    usage: '<user_id> | <song>',
	execute(message, args) {
        if (message.author.id === '122568101995872256') {
            db.user_stats.push(args[0], args[1], 'star_list');
            message.channel.send('Put in song.');
        } else {
            message.channel.send('This command is for Jeff\'s use only.');
        }
	},
};