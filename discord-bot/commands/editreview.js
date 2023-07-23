const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, handle_error, get_review_channel, convertToSetterName } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editreview')
        .setDescription('Edit a song review you\'ve made.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Edit/add data to a song review with spotify playback data.')

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The newly edited rating of the song.')
                    .setRequired(false)
                    .setMaxLength(3))
    
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The newly edited written review.')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('The newly edited user who sent you this song.')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Edit/add data to a song review with manually entered information.')

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
                option.setName('rating')
                    .setDescription('The newly edited rating of the song.')
                    .setRequired(false)
                    .setMaxLength(3))
    
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The newly edited written review.')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('The newly edited user who sent you this song.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Remixers involved in a remix of a song, for remix reviews.')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `Allows you to edit a review you have made for a song in the review database, and edits the review message in your review channel with the newly edited review.\n\n` +
    `Can be used for singles, remixes, or songs on an EP/LP review, but this CANNOT be used for EP/LP overall reviews or ratings. Use \`/epeditreview\` for that.\n\n` + 
    `Using the \`with_spotify\` subcommand will pull from your spotify playback to fill in arguments (if logged into Waveform with Spotify), ` + 
    `while the \`manually\` subcommand will allow you to type in the arguments manually.`,
	async execute(interaction, client, epCmd = false) {
        try {
            
        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        if (song != null) {
            if (song.includes(' EP') || song.incldes(' LP')) epCmd = true;
        }
        
        if (epCmd == true) {
            song = interaction.options.getString('ep_name');
        }
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(songName);

        let rating = interaction.options.getString('rating');
        if (rating != null) {
            if (rating.includes('/10')) rating = rating.replace('/10', '');
        }

        let review = interaction.options.getString('review');
        // Handle new lines
        if (review != null) {
            if (review.includes('\\n')) {
                review = review.split('\\n').join('\n');
            } 
        }

        let user_who_sent = interaction.options.getUser('user_who_sent');
        let taggedMember;
        let taggedUser;
        let oldrating;
        let oldreview;
        let user_sent_name;
        let songObj;
        let songReviewObj;
        let userStatsObj = db.user_stats.get(interaction.user.id, 'stats');
        let guildStatsObj;
        let botStatsObj = db.global_bot.get('stats');

        if (rating == null && review == null && user_who_sent == null) return interaction.reply('You must supply either a rating change, a review change, or a user_who_sent change.');
        if (user_who_sent != null && user_who_sent != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_who_sent);
            taggedUser = taggedMember.user;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.reply(`Artist ${artistArray[i]} not found!`);
            songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);
            if (songObj == undefined) return interaction.reply(`Song ${songName} not found!`);
            songReviewObj = songObj[interaction.user.id];
            if (songReviewObj == undefined) return interaction.reply(`Review not found!`);
            guildStatsObj = db.server_settings.get(songReviewObj.guild_id, 'stats');

            if (rating != null && rating != undefined) {
                if (rating < 8 && songReviewObj.starred == true) {
                    return interaction.reply(`This review has a star on it, so you cannot change the rating to anything under 8.\nRemove the star with \`/setstar\` if you'd like to lower the rating!`);
                }
                
                oldrating = songReviewObj.rating;
                if (userStatsObj.ratings_list[`${oldrating}`] != undefined && !isNaN(parseFloat(oldrating))) {
                    userStatsObj.ratings_list[`${oldrating}`] -= 1;
                }

                if (oldrating == 10 && rating != 10) {
                    userStatsObj.ten_num -= 1;
                    guildStatsObj.ten_num -= 1;
                    botStatsObj.ten_num -= 1;
                } else if (oldrating != 10 && rating == 10) {
                    userStatsObj.ten_num += 1;
                    guildStatsObj.ten_num += 1;
                    botStatsObj.ten_num += 1;
                }

                if (userStatsObj.ratings_list[`${rating}`] != undefined && !isNaN(parseFloat(rating))) {
                    userStatsObj.ratings_list[`${rating}`] += 1;
                } else if (!isNaN(parseFloat(rating))) {
                    userStatsObj.ratings_list[`${rating}`] = 1;
                }

                db.reviewDB.set(artistArray[i], parseFloat(rating), `${setterSongName}.${interaction.user.id}.rating`);
            } 

            if (review != null && review != undefined) {
                oldreview = songReviewObj.rating;
                db.reviewDB.set(artistArray[i], review, `${setterSongName}.${interaction.user.id}.review`);
            }

            if (user_who_sent != null && user_who_sent != undefined) {
                user_sent_name = await interaction.guild.members.fetch(user_who_sent);
                db.reviewDB.set(artistArray[i], user_who_sent.id, `${setterSongName}.${interaction.user.id}.user_who_sent`);
            }
        }

        let reviewMsgID = songReviewObj.msg_id;
        let reviewChannelID = songReviewObj.channel_id;
        let reviewGuildID = songReviewObj.guild_id;

        if (reviewMsgID != false) {
            let channelsearch = await get_review_channel(client, reviewGuildID, reviewChannelID, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);

                    if (epCmd == true) {
                        if (rating != null && songReviewObj.no_songs == false) {
                            // Change title
                            msgEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName} (${rating}/10)`);
                        } else if (rating != null && songReviewObj.no_songs == true) {
                            // Change field /10 rating value
                            if (msgEmbed.data.fields != undefined) {
                                msgEmbed.data.fields[0].value = `**${rating}/10**`;
                            } else {
                                msgEmbed.addFields({ name: `Rating:`, value: `**${rating}/10**` });
                            }
                        }

                        if (review != null) {
                            msgEmbed.setDescription(songReviewObj.no_songs == false ? `*${review}*` : `${review}`);
                        }
                    } else {
                        if (rating != null && rating != undefined) msgEmbed.data.fields[0].value = `**${rating}/10**`;
                        if (review != null && review != undefined) msgEmbed.setDescription(review);
                    }

                    if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: false })}` });

                    msg.edit({ embeds: [msgEmbed] });
                });
            }
        }

        let primArtist = artistArray[0];
        let epMsgToEdit = false;
        let epMsgGuild = false;
        let epMsgChannel = false;
        let epObj = false;

        for (let i = 0; i < artistArray.length; i++) {
            epObj = db.reviewDB.get(primArtist, db.reviewDB.get(primArtist, `${setterSongName}.ep`));
            if (epObj == undefined || epObj == false) break;
            if (epObj[interaction.user.id] == undefined || epObj[interaction.user.id] == false) break;
            epMsgToEdit = epObj[interaction.user.id].msg_id;
            epMsgChannel = epObj[interaction.user.id].channel_id;
            epMsgGuild = epObj[interaction.user.id].guild_id;
            if (epMsgToEdit != false && epMsgToEdit != undefined && epMsgToEdit != null) {
                primArtist = artistArray[i];
                break;
            } 
        }

        if (epObj != false && epObj != undefined && epCmd == false) {
            if (epMsgToEdit != undefined && epMsgToEdit != false) {
                let displayArtists = origArtistArray.filter(v => v != primArtist);
                let channelsearch = await get_review_channel(client, epMsgGuild, epMsgChannel, epMsgToEdit);
                if (channelsearch != undefined) {
                    channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                        let msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                        let msg_embed_fields = msgEmbed.data.fields;
                        let field_num = -1;
                        for (let i = 0; i < msg_embed_fields.length; i++) {
                            if (msg_embed_fields[i].name.includes(songName)) {
                                field_num = i;
                            }
                        }

                        if (rating != null && rating != undefined) {
                            if (msg_embed_fields[field_num].name.includes('🌟')) {
                                msg_embed_fields[field_num].name = `🌟 ${displaySongName}${displayArtists.length != 0 ? ` (with ${origArtistArray.join(' & ')})` : ``} (${rating}/10) 🌟`;
                            } else {
                                msg_embed_fields[field_num].name = `${displaySongName}${displayArtists.length != 0 ? ` (with ${origArtistArray.join(' & ')})` : ``} (${rating}/10)`;
                            }
                        } 
                        if (review != null && review != undefined && msg_embed_fields[field_num].value != '*Review hidden to save space*') msg_embed_fields[field_num].value = review;

                        msg.edit({ embeds: [msgEmbed] });
                    }).catch(() => {});
                }
            } 
        }

        // Finalize any edits made to stats
        db.user_stats.set(interaction.user.id, userStatsObj, 'stats');
        db.server_settings.set(songReviewObj.guild_id, guildStatsObj, 'stats');
        db.global_bot.set('stats', botStatsObj);

        interaction.reply(`Here's what was edited on your review of **${origArtistArray.join(' & ')} - ${displaySongName}**:\n` +
        `${(oldrating != undefined) ? `\`${oldrating}/10\` changed to \`${rating}/10\`\n` : ``}` +
        `${(oldreview != undefined) ? `Review was changed to \`${review}\`\n` : ``}` +
        `${(user_who_sent != null) ? `User Who Sent was changed to \`${user_sent_name.displayName}\`` : ``}`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};