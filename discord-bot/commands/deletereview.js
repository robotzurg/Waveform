const db = require("../db.js");
const { parse_artist_song_data, hall_of_fame_check, handle_error } = require("../func.js");
const wait = require('util').promisify(setTimeout);
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletereview')
		.setDescription('Delete a review!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, use this to delete remix reviews.')
                .setAutocomplete(true)
                .setRequired(false)),
	admin: false,
    async execute(interaction) {

        try {

        let parsed_args = parse_artist_song_data(interaction);

        if (parsed_args == -1) {
            return;
        }

        let origArtistArray = parsed_args[0];
        let origSongName = parsed_args[1];
        let artistArray = parsed_args[2];
        let songName = parsed_args[3];
        let rmxArtistArray = parsed_args[4];
        let vocalistArray = parsed_args[5];

        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        let userToDelete = interaction.user;
        let rname;

        // Update user stats
        if (db.user_stats.get(interaction.user.id, 'recent_review').includes(songName)) {
            db.user_stats.set(interaction.user.id, 'N/A', 'recent_review');
        }

        let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${userToDelete.id}"].msg_id`);

        if (reviewMsgID != false && reviewMsgID != undefined) {
            let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
            channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                await msg.delete();
            }).catch(() => {
                channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                if (channelsearch != undefined) {
                    channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                        msg.delete();
                    });
                }
            });
        }

        let songObj;
        for (let i = 0; i < artistArray.length; i++) {

            rname = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].name`);

            if (rname === undefined) break;

            songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);

            if (db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].starred`) == true) {
                // Create display song name variable
                let displaySongName = (`${origSongName}` + 
                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
                `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);
                
                db.user_stats.remove(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }`, 'star_list');
                db.reviewDB.set(artistArray[i], false, `["${songName}"].["${interaction.user.id}"].starred`);   
                hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName,
                    db.reviewDB.get(artistArray[0], `["${songName}"].art`), true);
            }

            delete songObj[`${userToDelete.id}`];
            songObj[`review_num`] -= 1;

            db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
        }

        await interaction.editReply(`Deleted <@${userToDelete.id}>'s review of ${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}.`);
        await wait(30000);
        try {
            await interaction.deleteReply();
        } catch (err) {
            console.log(err);
        }

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
	},
};