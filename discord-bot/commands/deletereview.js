const db = require("../db.js");
const { parse_artist_song_data, hall_of_fame_check, handle_error, find_review_channel } = require("../func.js");
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletereview')
		.setDescription('Delete a review!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song or EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, use this to delete remix reviews.')
                .setAutocomplete(true)
                .setRequired(false)),
	admin: false,
    async execute(interaction) {

        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);

        if (song_info == -1) {
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let origSongName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;

        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        let userToDelete = interaction.user;
        let rname;

        // Update user stats
        if (db.user_stats.get(interaction.user.id, 'recent_review').includes(songName)) {
            db.user_stats.set(interaction.user.id, 'N/A', 'recent_review');
        }

        let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${userToDelete.id}"].msg_id`);
        if (reviewMsgID != false && reviewMsgID != undefined) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(reviewMsgID).then(async msg => {
                    await msg.delete();
                });
            }
        }

        let songObj;
        for (let i = 0; i < artistArray.length; i++) {
            rname = db.reviewDB.get(artistArray[i], `["${songName}"].["${userToDelete.id}"].name`);
            if (rname == undefined) break;

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
            if (!songName.includes(' EP') && !songName.includes(' LP')) {
                songObj[`review_num`] -= 1;
            }

            db.reviewDB.set(artistArray[i], songObj, `["${songName}"]`);
        }

        await interaction.editReply(`Deleted <@${userToDelete.id}>'s review of ${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};