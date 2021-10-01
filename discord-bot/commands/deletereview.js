const db = require("../db.js");
const { capitalize } = require("../func.js");
const wait = require('util').promisify(setTimeout);
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletereview')
		.setDescription('Delete a review!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, use this to delete remix reviews.')
                .setRequired(false)),
	admin: false,
    async execute(interaction) {
        let args = [];
        let rmxArtists = [];

        await interaction.options._hoistedOptions.forEach(async (value) => {
            args.push(value.value);
            if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
            }
        });
        
        //Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        let userToDelete = interaction.user;
        let artistArray = args[0].split(' & ');
        let rname;
        let songName = args[1];

        if (rmxArtists.length != 0) {
            artistArray = rmxArtists;
            songName = `${songName} (${rmxArtists.join(' & ')} Remix)`;
        } 

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistArray = artistArray.flat(1);
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                artistArray = artistArray.flat(1);
            }
        }

        // Update user stats
        if (db.user_stats.get(interaction.user.id, 'recent_review').includes(songName)) {
            db.user_stats.set(interaction.user.id, 'N/A', 'recent_review');
        }

        let songObj;
        for (let i = 0; i < artistArray.length; i++) {

            rname = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].name`);

            if (rname === undefined) break;

            songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
            let reviewMsgID = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].msg_id`);
            console.log(reviewMsgID);

            delete songObj[`${userToDelete.id}`];
            songObj[`review_num`] -= 1;

            if (reviewMsgID != false && reviewMsgID != undefined) {
                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    msg.delete();
                }).catch(() => {
                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                    channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                        msg.delete();
                    });
                });
            }

            db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
        }

        await interaction.editReply(`Deleted <@${userToDelete.id}>'s review of ${args[0]} - ${songName}.`);
        await wait(5000);
        await interaction.deleteReply();
	},
};