const db = require("../db.js");
const { parse_artist_song_data, handle_error, get_review_channel, updateStats, spotify_api_setup, convertToSetterName } = require("../func.js");
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
    async execute(interaction, client) {

        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);

        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let displaySongName = song_info.display_song_name;
        let artistArray = song_info.db_artists;
        let rmxArtistArray = song_info.remix_artists;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(songName);
        let songObj = db.reviewDB.get(origArtistArray[0], `${setterSongName}`);

        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray;
            songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
        }

        // Delete review message
        let reviewMsgID = songObj[interaction.user.id].msg_id;
        let reviewChannelID = songObj[interaction.user.id].channel_id;
        let reviewGuildID = songObj[interaction.user.id].guild_id;
        if (reviewGuildID == false) reviewGuildID = '680864893552951306';
        if (reviewMsgID != false && reviewMsgID != undefined) {
            let channelsearch = await get_review_channel(client, reviewGuildID, reviewChannelID, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(reviewMsgID).then(async msg => {
                    await msg.delete();
                });
            }
        }

        // Update user statistics
        await updateStats(interaction, reviewGuildID, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, songObj, (songName.includes(' EP') || songName.includes(' LP') ? true : false), true);

        for (let i = 0; i < artistArray.length; i++) {
            songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);
            let songReviewObj = songObj[interaction.user.id];
            if (songReviewObj.name == undefined) break;

            if (songReviewObj.starred == true) {
                let spotifyUri = song_info.spotify_uri;
                let spotifyApi = await spotify_api_setup(interaction.user.id);
                let starPlaylistId = db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist');

                db.reviewDB.set(artistArray[i], false, `${setterSongName}.${interaction.user.id}.starred`);   
                if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                    // Remove from spotify playlist
                    await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }])
                    .then(() => {}, function(err) {
                        console.log('Something went wrong!', err);
                    });
                }
            }

            delete songObj[`${interaction.user.id}`];
            if (!songName.includes(' EP') && !songName.includes(' LP')) {
                songObj.review_num -= 1;
            }

            db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
        }

        await interaction.reply(`Deleted ${interaction.member.displayName}'s review of ${origArtistArray.join(' & ')} - ${displaySongName}.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};