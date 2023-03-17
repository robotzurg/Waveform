const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generate_hof')
        .setDescription('Generate hof.')
        .setDMPermission(false),
    help_desc: 'TBD',
	async execute(interaction, client) {
        if (interaction.user.id != '122568101995872256') interaction.reply('This command is not for you.');

        let songSkip = [];
        let songsStars = [];
        let starCount = 0;
        let artistArray = db.reviewDB.keyArray();
        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            songArray = songArray.filter(v => v != 'Image');

            for (let j = 0; j < songArray.length; j++) {
                let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                let userArray;
                starCount = 0;
                if (songObj != null && songObj != undefined) {
                    userArray = get_user_reviews(songObj);
                } else {
                    userArray = [];
                }

                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                let otherArtists = [artistArray[i], songObj.collab].flat(1);

                let allArtists = otherArtists.map(v => {
                    if (v == undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);

                for (let k = 0; k < userArray.length; k++) {
                    let userData = songObj[userArray[k]];
                    if (userData.starred) {
                        starCount += 1;
                    }
                }

                if (starCount >= 3) {
                    songsStars.push({
                        artists: allArtists,
                        name: songArray[j],
                        display_name: `${allArtists} - ${songArray[j]}`,
                        hof_msg_id: false,
                        stars: starCount,
                    });
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                    }
                }
            }
        }

        db.server_settings.set(interaction.guild.id, songsStars, 'hall_of_fame');
    },
};
