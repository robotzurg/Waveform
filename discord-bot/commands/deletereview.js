const db = require("../db.js");
const { parse_artist_song_data, handle_error, get_review_channel, updateStats, spotify_api_setup, convertToSetterName } = require("../func.js");
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletereview')
		.setDescription('Delete a review you\'ve made.')
        .setDMPermission(false)
        .addSubcommandGroup(group =>
            group.setName('song')
            .setDescription('Delete a song review you have made.')
            .addSubcommand(subcommand => 
                subcommand.setName('with_spotify')
                .setDescription('Delete a song review with spotify playback data.'))

            .addSubcommand(subcommand =>
                subcommand.setName('manually')
                .setDescription('Delete a song review with manually entered information.')

                .addStringOption(option => 
                    option.setName('artist')
                        .setDescription('The name of primary artist(s).')
                        .setAutocomplete(true)
                        .setRequired(true))
        
                .addStringOption(option => 
                    option.setName('song_name')
                        .setDescription('The song name.')
                        .setAutocomplete(true)
                        .setRequired(true))

                .addStringOption(option => 
                    option.setName('remixers')
                        .setDescription('Remixers involved in a remix of a song, for remix reviews.')
                        .setAutocomplete(true)
                        .setRequired(false))))

        .addSubcommandGroup(group =>
            group.setName('album')
            .setDescription('Delete an album or EP review you have made.')
            .addSubcommand(subcommand => 
            subcommand.setName('with_spotify')
                .setDescription('Delete an album or EP review with spotify playback data.'))

            .addSubcommand(subcommand =>
                subcommand.setName('manually')
                .setDescription('Delete an album or EP review with manually entered information.')

                .addStringOption(option => 
                    option.setName('artist')
                        .setDescription('The name of primary artist(s).')
                        .setAutocomplete(true)
                        .setRequired(true))
        
                .addStringOption(option => 
                    option.setName('album_name')
                        .setDescription('The album or EP name.')
                        .setAutocomplete(true)
                        .setRequired(true)))),
    help_desc: `Delete a review you have made from the review database.\n\n` + 
    `This only deletes YOUR review, not anyone else's review or the song/artist data itself.\n\n` + 
    `Leaving the artist and song name arguments blank will pull from currently playing song on Spotify, if you are logged in to Waveform with Spotify.`,
    async execute(interaction, client, serverConfig, userID = false) {

        try {

        let isAdminDelete = false;
        if (userID == false) {
            userID = interaction.user.id;
        } else {
            isAdminDelete = true;
        }

        let subcommand = interaction.options.getSubcommand();
        let artists = interaction.options.getString('artist');
        let song = null;
        if (subcommand == 'song') {
            song = interaction.options.getString('song_name');
        } else {
            song = interaction.options.getString('album_name');
        }

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

        if (songObj == undefined) return interaction.reply(`**${origArtistArray.join(' & ')} - ${displaySongName}** has not been reviewed on Waveform.`);
        if (songObj[userID] == undefined) return interaction.reply('You don\'t have a review of this in Waveform, so there is nothing to delete.');

        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray;
            songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
        }

        // Delete review message
        let reviewMsgID = songObj[userID].msg_id;
        let reviewChannelID = songObj[userID].channel_id;
        let reviewGuildID = songObj[userID].guild_id;
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
        if (userID == interaction.user.id) {
            await updateStats(interaction, reviewGuildID, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, songObj, (songName.includes(' EP') || songName.includes(' LP') ? true : false), true);
        } else {
            await updateStats({ user: { id: userID } }, reviewGuildID, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, songObj, (songName.includes(' EP') || songName.includes(' LP') ? true : false), true);
        }

        for (let i = 0; i < artistArray.length; i++) {
            songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);
            let songReviewObj = songObj[userID];
            if (songReviewObj.name == undefined) break;

            if (songReviewObj.starred == true) {
                let spotifyUri = song_info.spotify_uri;
                let spotifyApi = await spotify_api_setup(interaction.user.id);
                let starPlaylistId = db.user_stats.get(userID, 'config.star_spotify_playlist');

                db.reviewDB.set(artistArray[i], false, `${setterSongName}.${userID}.starred`);   
                if (spotifyApi != false && db.user_stats.get(userID, 'config.star_spotify_playlist') != false && db.user_stats.get(userID, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                    // Remove from spotify playlist
                    await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }])
                    .then(() => {}, function(err) {
                        console.log('Something went wrong!', err);
                    });
                }
            }

            delete songObj[`${userID}`];
            if (!songName.includes(' EP') && !songName.includes(' LP')) {
                songObj.review_num -= 1;
            }

            db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
        }

        await interaction.reply(`Deleted ${isAdminDelete ? `your` : `**${interaction.member.displayName}**'s`} review of **${origArtistArray.join(' & ')} - ${displaySongName}**.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};