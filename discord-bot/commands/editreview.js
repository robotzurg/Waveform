const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, handle_error, get_review_channel, convertToSetterName, checkForGlobalReview } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editreview')
        .setDescription('Edit a song or EP/LP review you\'ve made.')
        .setDMPermission(false)
        // Group for songs
        .addSubcommandGroup(group =>
            group.setName('song')
            .setDescription('Edit a song review you have made.')
            .addSubcommand(subcommand => 
                subcommand.setName('with_spotify')
                .setDescription('Edit/add data to a song review with spotify playback data.')

                .addStringOption(option => 
                    option.setName('rating')
                        .setDescription('The newly edited rating of the song. (Type "-" to remove)')
                        .setRequired(false)
                        .setMaxLength(3))
        
                .addStringOption(option => 
                    option.setName('review')
                        .setDescription('The newly edited written review. (Type "-" to remove)')
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
                        .setDescription('The newly edited rating of the song. (Type "-" to remove)')
                        .setRequired(false)
                        .setMaxLength(3))
        
                .addStringOption(option => 
                    option.setName('review')
                        .setDescription('The newly edited written review. (Type "-" to remove)')
                        .setRequired(false))
        
                .addUserOption(option => 
                    option.setName('user_who_sent')
                        .setDescription('The newly edited user who sent you this song.')
                        .setRequired(false))

                .addStringOption(option => 
                    option.setName('remixers')
                        .setDescription('Remixers involved in a remix of a song, for remix reviews.')
                        .setAutocomplete(true)
                        .setRequired(false))))

        .addSubcommandGroup(group =>
            group.setName('album')
            .setDescription('Edit an album or EP review you have made.')
            .addSubcommand(subcommand => 
                subcommand.setName('with_spotify')
                .setDescription('Edit/add data to an album or EP review with spotify playback data.')

                .addStringOption(option => 
                    option.setName('rating')
                        .setDescription('The newly edited rating of the EP/LP. (Type "-" to remove)')
                        .setRequired(false)
                        .setMaxLength(3))
        
                .addStringOption(option => 
                    option.setName('review')
                        .setDescription('The newly edited written review. (Type "-" to remove)')
                        .setRequired(false))
        
                .addUserOption(option => 
                    option.setName('user_who_sent')
                        .setDescription('The newly edited user who sent you this EP/LP.')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Edit/add data to a EP/LP review with manually entered information.')

            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of primary artist(s).')
                    .setAutocomplete(true)
                    .setRequired(true))
    
            .addStringOption(option => 
                option.setName('album_name')
                    .setDescription('The album or EP name.')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The newly edited rating of the EP/LP. (Type "-" to remove)')
                    .setRequired(false)
                    .setMaxLength(3))
    
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The newly edited written review. (Type "-" to remove)')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('The newly edited user who sent you this EP/LP.')
                    .setRequired(false)))),
    help_desc: `Allows you to edit a review you have made for a song or EP/LP in the review database, and edits the review message in your review channel with the newly edited review.\n\n` +
    `Can be used for all types of reviews, using either the "song" subcommand for songs/remixes, or the "ep" command for EPs/LPs/Albums.\n\n` + 
    `Using the \`with_spotify\` subcommand will pull from your spotify playback to fill in arguments (if logged into Waveform with Spotify), ` + 
    `while the \`manually\` subcommand will allow you to type in the arguments manually.`,
	async execute(interaction, client, serverConfig) {
        try {

        let epCmd = false;
        if (interaction.options.getSubcommandGroup() == 'album') {
            epCmd = true;
        }
            
        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        if (song != null) {
            if (song.includes(' EP') || song.includes(' LP')) epCmd = true;
        }
        
        if (epCmd == true) {
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
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;
        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(songName);

        let rating = interaction.options.getString('rating');
        if (rating != null && rating !== '-') {
            if (rating.includes('/10')) rating = rating.replace('/10', '');
            if (isNaN(rating)) return interaction.reply('Your rating must be a valid number or decimal between 0-10, or `-` to remove a rating.');
            if (parseFloat(rating) < 0 || parseFloat(rating) > 10) return interaction.reply('Your rating must be between 0-10.');
        } else if (rating === '-') {
            rating = false;
        }
        
        // Disable ratings check
        if (serverConfig.disable_ratings === true) {
            rating = null;
        }

        let review = interaction.options.getString('review');
        // Handle new lines
        if (review != null && review !== '-') {
            if (review.includes('\\n')) {
                review = review.split('\\n').join('\n');
            } 
        } else if (review === '-') {
            review = false;
        }

        if (rating == false && review == false) {
            return interaction.reply('You cannot remove both your rating and your review at the same time. You can only remove one or the other.');
        }

        let user_who_sent = interaction.options.getUser('user_who_sent');
        let taggedMember;
        let taggedUser;
        let oldrating;
        let oldreview;
        let user_sent_name;
        let songObj;
        let msgEmbed;
        let songReviewObj;
        let userStatsObj = db.user_stats.get(interaction.user.id, 'stats');
        let guildStatsObj;
        let botStatsObj = db.global_bot.get('stats');

        // This gets an extra message if the disable ratings setting is enabled.
        if (rating == null && review == null && user_who_sent == null) {
            return interaction.reply('You must supply either a rating change, a review change, or a user_who_sent change.' + 
            `${serverConfig.disable_ratings ? `\n**Note: Your server admins have disabled ratings for the bot in this server, so you cannot edit your rating here.**` : ``}`);
        }

        if (user_who_sent != null && user_who_sent != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_who_sent);
            taggedUser = taggedMember.user;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.reply(`Artist ${artistArray[i]} not found!`);
            songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);
            if (songObj == undefined) return interaction.reply(`Song ${songName} not found!`);
            songReviewObj = songObj[interaction.user.id];

            if (serverConfig.disable_global) {
                if (checkForGlobalReview(songReviewObj, interaction.guild.id) == true) {
                    return interaction.reply('This review was made in another server, and cannot be edited here due to this server blocking external reviews from other servers.');
                }
            }

            if (songReviewObj == undefined) return interaction.reply(`Review not found!`);
            if (songReviewObj.guild_id === false) songReviewObj.guild_id = '680864893552951306';
            guildStatsObj = db.server_settings.get(songReviewObj.guild_id, 'stats');
            if ((songReviewObj.rating === false && review == false) || (songReviewObj.review == false && rating === false)) {
                return interaction.reply('You cannot remove both the rating and review at the same time.');
            }

            if (rating != null && rating != undefined) {
                
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

                db.reviewDB.set(artistArray[i], rating === false ? rating : parseFloat(rating), `${setterSongName}.${interaction.user.id}.rating`);
            } 

            if (review != null && review != undefined) {
                oldreview = songReviewObj.review;
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
                await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                    msgEmbed = EmbedBuilder.from(msg.embeds[0]);

                    if (epCmd == true) {
                        if (rating != null && songReviewObj.no_songs == false) {
                            // Change title
                            if (rating != false) {
                                msgEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName} (${rating}/10)`);
                            } else if (rating === false) {
                                msgEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                            }
                        } else if (rating != null && songReviewObj.no_songs == true) {
                            // Change field /10 rating value
                            if (msgEmbed.data.fields != undefined) {
                                msgEmbed.data.fields[0].value = `**${rating}/10**`;
                                if (rating === false) {
                                    delete msgEmbed.data.fields[0];
                                }
                            } else if (rating !== false) {
                                msgEmbed.addFields({ name: `Rating:`, value: `**${rating}/10**` });
                            }
                        }

                        if (review != null && review !== false) {
                            msgEmbed.setDescription(songReviewObj.no_songs == false ? `*${review}*` : `${review}`);
                        } else if (review === false) {
                            msgEmbed.setDescription(null);
                        }
                    } else {
                        if (rating != null && rating != undefined && rating !== false) {
                            msgEmbed.data.fields = [];
                            msgEmbed.addFields([{ name: `Rating`, value: `**${rating}/10**` }]);
                        } else if (rating === false) {
                            msgEmbed.data.fields = [];
                        }

                        if (review != null && review != undefined && review !== false) {
                            msgEmbed.setDescription(review);
                        } else if (review === false) {
                            msgEmbed.setDescription(null);
                        }
                    }

                    if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: true })}` });

                    await msg.edit({ embeds: [msgEmbed] });
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
                    channelsearch.messages.fetch(`${epMsgToEdit}`).then(async msg => {
                        msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                        let msg_embed_fields = msgEmbed.data.fields;
                        let field_num = -1;
                        for (let i = 0; i < msg_embed_fields.length; i++) {
                            if (msg_embed_fields[i].name.includes(songName)) {
                                field_num = i;
                            }
                        }

                        if (rating != null && rating != undefined) {
                            if (msg_embed_fields[field_num].name.includes('🌟')) {
                                msg_embed_fields[field_num].name = `🌟 ${displaySongName}${displayArtists.length != 0 ? ` (with ${displayArtists.join(' & ')})` : ``}${rating !== false ? ` (${rating}/10)` : ``} 🌟`;
                            } else {
                                msg_embed_fields[field_num].name = `${displaySongName}${displayArtists.length != 0 ? ` (with ${displayArtists.join(' & ')})` : ``}${rating !== false ? ` (${rating}/10)` : ``}`;
                            }
                        } 
                        if (review === false) { 
                            msg_embed_fields[field_num].value = '*No Review Written*';
                        } else if (review != null && review != undefined && msg_embed_fields[field_num].value != '*Review hidden to save space*') {
                            msg_embed_fields[field_num].value = review;
                        }

                        msg.edit({ embeds: [msgEmbed] });
                    }).catch(() => {});
                }
            } 
        }

        // Finalize any edits made to stats
        db.user_stats.set(interaction.user.id, userStatsObj, 'stats');
        db.server_settings.set(songReviewObj.guild_id, guildStatsObj, 'stats');
        db.global_bot.set('stats', botStatsObj);

        if ((oldrating != undefined && oldrating != rating) || (oldreview != undefined && oldreview != review) || user_who_sent != null) {

            let channelsearch = await get_review_channel(client, reviewGuildID, reviewChannelID, reviewMsgID);
            if (channelsearch != undefined && epCmd == false) {
                await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                    msgEmbed = [msg.embeds[0]];
                }).catch(() => msgEmbed = []);
            } else {
                msgEmbed = [];
            }

            await interaction.reply({ content: `**Changes made to your \`${origArtistArray.join(' & ')} - ${displaySongName}\` review:**\n` +
            `${(oldrating != undefined && oldrating != rating) ? `- ${oldrating === false ? `\`No Rating\`` : `\`${oldrating}/10\``} changed to ${rating === false ? `\`No Rating\`` : `\`${rating}/10\``}\n` : ``}` +
            `${(oldreview != undefined && oldreview != review) ? `- Review was changed to ${review === false ? `\`No Review\`` : `\`${review}\``}\n` : ``}` +
            `${(user_who_sent != null) ? `- User Who Sent was changed to \`${user_sent_name.displayName}\`\n` : ``}` +
            `${msgEmbed.length != 0 ? `**Edited Review**` : ``}`, embeds: msgEmbed });
            
            const review_msg = await interaction.fetchReply();
            let timestamp = review_msg.createdTimestamp;
            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], timestamp, `${setterSongName}.${interaction.user.id}.timestamp`);
            }
        } else {
            await interaction.reply(`Nothing on the review was changed.`);
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};