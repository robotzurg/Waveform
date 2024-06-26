const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, handle_error, get_review_channel, spotify_api_setup, convertToSetterName, arrayEqual, checkForGlobalReview } = require('../func.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setfavorite')
		.setDescription('Toggle a favorite on a review you have made.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('Set a favorite for a song/remix.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song/remix.')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Remix artists on the song, if any.')
                    .setAutocomplete(true)
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('album')
            .setDescription('Set a favorite for an album or EP.')
            .addStringOption(option =>
                option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(false))

            .addStringOption(option => 
                option.setName('album_name')
                    .setDescription('The name of the album or EP.')
                    .setAutocomplete(true)
                    .setRequired(false))),
        
    help_desc: `Adds a review to your favorites (or removes one, if the review is in your favorites)\n\n` + 
    `A favorite is a personal accolade you can give a song. It is up to you how you want to use favorites.\n\n` + 
    `Leaving the artist, song_name, and remixers arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)\n\n` + 
    `The remixers argument should have the remixer specified if you are trying to pull up a remix, the remixer should be put in the song_name or artists arguments.`,
	async execute(interaction, client, serverConfig) {
        try {

        let subcommand = interaction.options.getSubcommand();
        let artists = interaction.options.getString('artist');
        let song;
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
        let rmxArtistArray = song_info.remix_artists;
        let artistArray = song_info.db_artists;
        let spotifyUri = song_info.spotify_uri;
        let spotifyApi = await spotify_api_setup(interaction.user.id);
        let starPlaylistId = db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist');
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(songName);
        let userStatsObj = db.user_stats.get(interaction.user.id, 'stats');
        let guildStatsObj;
        let botStatsObj = db.global_bot.get('stats');

        if (!db.reviewDB.has(artistArray[0])) return interaction.reply(`${artistArray[0]} not found in database.`);
        let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
        if (songObj == undefined) return interaction.reply(`${origArtistArray.join(' & ')} - ${displaySongName} not found in database.`);
        let songReviewObj = songObj[interaction.user.id];
        if (songReviewObj == undefined) return interaction.reply(`You haven't reviewed ${origArtistArray.join(' & ')} - ${displaySongName}.`);

        if (serverConfig.disable_global) {
            if (checkForGlobalReview(songReviewObj, interaction.guild.id) == true) {
                return interaction.reply('This review was made in another server, and cannot be edited here due to this server blocking external reviews from other servers.');
            }
        }

        if (songReviewObj.guild_id == false) songReviewObj.guild_id = '680864893552951306';
        guildStatsObj = db.server_settings.get(songReviewObj.guild_id, 'stats');

        let star_check = songReviewObj.starred;
        if (star_check == undefined) star_check = false;
        if (spotifyUri == undefined) spotifyUri = false;
        
        for (let i = 0; i < artistArray.length; i++) {
            if (star_check == true) {
                await db.reviewDB.set(artistArray[i], false, `${setterSongName}.${interaction.user.id}.starred`);
            } else if (star_check == false) {
                db.reviewDB.set(artistArray[i], true, `${setterSongName}.${interaction.user.id}.starred`);
            } else {
                handle_error(interaction, client, `Error in starring process`);
            }

            // Replace spotify URI in the database (if spotify command, always replace, if manual, only replace if nothing is there)
            if (artists == null && song == null) {
                db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);
            } else if (songObj.spotify_uri == false || songObj.spotify_uri == undefined) {
                db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);
            }
        }

        if (star_check == false) {
            interaction.reply(`Favorited **${origArtistArray.join(' & ')} - ${displaySongName}**!`);

            userStatsObj.star_num += 1;
            guildStatsObj.star_num += 1;
            botStatsObj.star_num += 1;

            if (!userStatsObj.star_list.some(v => arrayEqual(v.db_artists, artistArray) && v.db_song_name == songName)) {
                userStatsObj.star_list.push({ 
                    db_artists: artistArray,
                    orig_artists: origArtistArray,
                    rmx_artists: rmxArtistArray,
                    db_song_name: songName,
                    display_name: displaySongName,
                    spotify_uri: songObj.spotify_uri,
                });
            }

            if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false 
                && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false
                && subcommand != 'ep') {
                // Remove from spotify playlist
                await spotifyApi.addTracksToPlaylist(starPlaylistId, [spotifyUri])
                .then(() => {}, function(err) {
                    console.log('Something went wrong!', err);
                });
            }
        } else {
            interaction.reply(`Un-favorited **${origArtistArray.join(' & ')} - ${displaySongName}**.`);

            userStatsObj.star_num -= 1;
            guildStatsObj.star_num -= 1;
            botStatsObj.star_num -= 1;

            if (userStatsObj.star_list.some(v => arrayEqual(v.db_artists, artistArray) && v.db_song_name == songName)) {
                userStatsObj.star_list = userStatsObj.star_list.filter(v => v.db_song_name != songName && !arrayEqual(v.db_artists, artistArray));
            }

            if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false
                && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false
                && subcommand != 'ep') {
                // Remove from spotify playlist
                await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }])
                .then(() => {}, function(err) {
                    console.log('Something went wrong!', err);
                });
            }
        }

        db.user_stats.set(interaction.user.id, userStatsObj, 'stats');
        db.server_settings.set(songReviewObj.guild_id, guildStatsObj, 'stats');
        db.global_bot.set('stats', botStatsObj);

        let msgtoEdit = songReviewObj.msg_id;

        if (msgtoEdit != false && msgtoEdit != undefined) {
            let channelsearch = await get_review_channel(client, songReviewObj.guild_id, songReviewObj.channel_id, songReviewObj.msg_id);
            if (channelsearch != undefined) {
                await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                    msgEmbed.data.title = msgEmbed.data.title.replace(':star2:', '🌟');
                    let msgEmbedTitle = msgEmbed.data.title;
                    if (star_check == false) {
                        if (!msgEmbedTitle.includes('🌟')) {
                            msgEmbed.setTitle(`🌟 ${msgEmbedTitle} 🌟`);
                        }
                    } else {
                        if (msgEmbedTitle.includes('🌟')) {
                            while (msgEmbed.data.title.includes('🌟')) {
                                msgEmbed.data.title = msgEmbed.data.title.replace('🌟', '');
                                msgEmbed.setTitle(msgEmbed.data.title);
                            }
                        }
                    }
                    msg.edit({ embeds: [msgEmbed] });   
                }).catch((err) => {
                    handle_error(interaction, client, err);
                });
            }
        }

        let ep_from = songObj.ep;
        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id] != undefined) {
                let epMsgID = db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id].msg_id;
                let epGuildID = db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id].guild_id;
                let epChannelID = db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id].channel_id;
                let channelsearch = await get_review_channel(client, epGuildID, epChannelID, epMsgID);
                if (channelsearch == undefined) return;

                channelsearch.messages.fetch(`${epMsgID}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                    let msg_embed_fields = msgEmbed.data.fields;
                    let field_num = -1;
                    for (let i = 0; i < msg_embed_fields.length; i++) {
                        if (msg_embed_fields[i].name.includes(songName)) {
                            field_num = i;
                        }
                    }
                    if (field_num === -1) return;

                    if (star_check == false) {
                        if (!msg_embed_fields[field_num].name.includes('🌟')) {
                            msg_embed_fields[field_num].name = `🌟 ${msg_embed_fields[field_num].name} 🌟`;
                        }
                    } else {
                        if (msg_embed_fields[field_num].name.includes('🌟')) {
                            while (msg_embed_fields[field_num].name.includes('🌟')) {
                                msg_embed_fields[field_num].name = msg_embed_fields[field_num].name.replace('🌟', '');
                            }
                        }
                    }

                    msg.edit({ embeds: [msgEmbed] });
                }).catch((err) => {
                    handle_error(interaction, client, err);
                });
            } 
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};