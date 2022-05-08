const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, get_user_reviews } = require('../func');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)'),
	async execute(interaction) {
        try {
            if (interaction.user.id != '122568101995872256') return interaction.editReply('This ain\'t for you bud');
            interaction.editReply('Test!');
            let artistArray = db.reviewDB.keyArray();

            for (let i = 0; i < artistArray.length; i++) {
                let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
                songArray = songArray.filter(v => v != 'Image');

                for (let j = 0; j < songArray.length; j++) {
                    let userArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"]`);
                    if (userArray != null && userArray != undefined) {
                        userArray = get_user_reviews(userArray);
                    } else {
                        userArray = [];
                    }

                    for (let k = 0; k < userArray.length; k++) {
                        let userData = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].["${userArray[k]}"]`);
                        if (userData.review == 'This was from a ranking, so there is no written review for this song.') {
                            db.reviewDB.set(artistArray[i], '-', `["${songArray[j]}"].["${userArray[k]}"].review`);
                        }
                    }
                }
            }
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};