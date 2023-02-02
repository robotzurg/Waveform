const db = require("../db.js");
const { parse_artist_song_data, hall_of_fame_check, handle_error, find_review_channel } = require("../func.js");
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletereview')
		.setDescription('Delete a review you\'ve made.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song/EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, for remix reviews.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `Delete a review you have made from the review database.\n` + 
    `This only deletes YOUR review, not anyone else's review or the song/artist data itself.\n\n` + 
    `Leaving the artist and song name arguments blank will pull from currently playing song on Spotify, if you are logged in to Waveform with Spotify.\n\n`,
    async execute(interaction) {

        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);

        if (song_info == -1) {
            await interaction.reply('Waveform ran into an issue pulling up song data.');
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let origSongName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let rmxArtistArray = song_info.remix_artists;
        let vocalistArray = song_info.vocal_artists;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

        if (rmxArtistArray.length != 0) artistArray = rmxArtistArray;

        // Update user stats
        if (db.user_stats.get(interaction.user.id, 'recent_review').includes(songName)) {
            db.user_stats.set(interaction.user.id, 'N/A', 'recent_review');
        }

        // Delete review message
        let reviewMsgID = db.reviewDB.get(artistArray[0])[songName][interaction.user.id].msg_id;
        if (reviewMsgID != false && reviewMsgID != undefined) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(reviewMsgID).then(async msg => {
                    await msg.delete();
                });
            }
        }

        for (let i = 0; i < artistArray.length; i++) {
            let songObj = db.reviewDB.get(artistArray[i], `["${songName}"]`);
            let songReviewObj = songObj[interaction.user.id];
            if (songReviewObj.name == undefined) break;

            if (songReviewObj.starred == true) {
                // Create display song name variable
                let displaySongName = (`${origSongName}` + 
                `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
                `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);
                
                db.user_stats.remove(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }`, 'star_list');
                db.reviewDB.set(artistArray[i], false, `${setterSongName}.${interaction.user.id}.starred`);   
                hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songObj.art, true);
            }

            delete songObj[`${interaction.user.id}`];
            if (!songName.includes(' EP') && !songName.includes(' LP')) {
                songObj.review_num -= 1;
            }

            db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
        }

        await interaction.reply(`Deleted ${interaction.member.displayName}'s review of ${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};