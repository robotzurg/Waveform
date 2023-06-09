const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, handle_error, find_review_channel, spotify_api_setup, get_user_reviews } = require('../func.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setstar')
		.setDescription('Toggle a star on a review you have made.')
        .setDMPermission(false)
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
                .setDescription('Remix artists on the song.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {
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
        let artistArray = song_info.db_artists;
        let vocalistArray = song_info.vocal_artists;
        let spotifyUri = song_info.spotify_uri;
        let spotifyApi = await spotify_api_setup(interaction.user.id);
        let starPlaylistId = db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist');
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

        if (!db.reviewDB.has(artistArray[0])) return interaction.reply(`${artistArray[0]} not found in database.`);
        let songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) return interaction.reply(`${origArtistArray.join(' & ')} - ${songName} not found in database.`);
        let songReviewObj = songObj[interaction.user.id];
        if (songReviewObj == undefined) return interaction.reply(`You haven't reviewed ${origArtistArray.join(' & ')} - ${songName}.`);
        if (songReviewObj.rating != false) {
            if (songReviewObj.rating < 8) return interaction.reply(`You haven't rated ${origArtistArray.join(' & ')} - ${songName} an 8/10 or higher!`);
        }

        let star_check = songReviewObj.starred;
        if (star_check == undefined) star_check = false;
        if (spotifyUri == undefined) spotifyUri = false;
        
        for (let i = 0; i < artistArray.length; i++) {
            if (star_check == true) {
                await db.reviewDB.set(artistArray[i], false, `${setterSongName}.${interaction.user.id}.starred`);
            } else if (star_check == false) {
                db.reviewDB.set(artistArray[i], true, `${setterSongName}.${interaction.user.id}.starred`);
            } else {
                handle_error(interaction, `Error in starring process`);
            }

            // Replace spotify URI in the database (if spotify command, always replace, if manual, only replace if nothing is there)
            if (artists == null && song == null) {
                db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);
            } else if (songObj.spotify_uri == false || songObj.spotify_uri == undefined) {
                db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);
            }
        }

        if (star_check == false) {
            interaction.reply(`Star added to **${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }**!`);
        
            if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                // Remove from spotify playlist
                await spotifyApi.addTracksToPlaylist(starPlaylistId, [spotifyUri])
                .then(() => {}, function(err) {
                    console.log('Something went wrong!', err);
                });
            }
        } else {
            interaction.reply(`Unstarred **${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }**.`);

            if (spotifyApi != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != false && db.user_stats.get(interaction.user.id, 'config.star_spotify_playlist') != undefined && spotifyUri != false) {
                // Remove from spotify playlist
                await spotifyApi.removeTracksFromPlaylist(starPlaylistId, [{ uri: spotifyUri }])
                .then(() => {}, function(err) {
                    console.log('Something went wrong!', err);
                });
            }
        }

        // Check if the song was added to hall of fame
        let userReviews = get_user_reviews(db.reviewDB.get(artistArray[0], `${setterSongName}`));
        let starCount = 0;
        for (let userRev of userReviews) {
            let userRevObj = db.reviewDB.get(origArtistArray[0], `${setterSongName}.${userRev}`);
            if (userRevObj.starred == true) starCount += 1;
        }

        if (starCount >= db.server_settings.get(interaction.guild.id, 'star_cutoff')) {
            await interaction.channel.send({ content: `🏆 **${origArtistArray.join(' & ')} - ${songName}** has been added to the Hall of Fame for this server!` });
        }

        let msgtoEdit = songReviewObj.msg_id;

        if (msgtoEdit != false && msgtoEdit != undefined) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, msgtoEdit);
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
                    handle_error(interaction, err);
                });
            }
        }

        let ep_from = songObj.ep;
        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id] != undefined) {
                let epMsgToEdit = db.reviewDB.get(artistArray[0])[ep_from][interaction.user.id].msg_id;
                let channelsearch = await find_review_channel(interaction, interaction.user.id, epMsgToEdit);
                if (channelsearch == undefined) return;

                channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                    let msg_embed_fields = msgEmbed.data.fields;
                    let field_num = -1;
                    for (let i = 0; i < msg_embed_fields.length; i++) {
                        if (msg_embed_fields[i].name.includes(songName)) {
                            field_num = i;
                        }
                    }

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
                    handle_error(interaction, err);
                });
            } 
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};