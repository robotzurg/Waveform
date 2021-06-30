const db = require("../db.js");
const { get_args } = require('../func.js');

module.exports = {
    name: 'setprofile',
    description: 'Set aspects of your profile.',
    options: [
        {
            name: 'setting',
            type: 'STRING',
            description: 'Which setting to set.',
            required: true,
            choices: [
                { name: 'Favorite Song', value: 'FS' },
                { name: 'Least Favorite Song', value: 'LFS' },
            ],   
        }, {
            name: 'value',
            type: 'STRING',
            description: 'The value to put in. (Full song name!)',
            required: true,
        },
    ],
	admin: false,
	async execute(interaction) {
        let args = [];
        args = get_args(interaction, args);

        if (args[0] === 'FS') {
            db.user_stats.set(interaction.user.id, args[1], 'fav_song');
            interaction.editReply(`Set favorite song to ${args[1]}`);
        } else {
            db.user_stats.set(interaction.user.id, args[1], 'least_fav_song');
            interaction.editReply(`Set least favorite song to ${args[1]}`);
        }
    },
};