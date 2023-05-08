const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { parse_artist_song_data, handle_error, find_review_channel } = require("../func.js");

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
    help_desc: `Allows you to edit a review you have made for a song in the review database, and edits the review message in your review channel with the newly edited review.\n` +
    `Can be used for singles, remixes, or songs on an EP/LP review, but this CANNOT be used for EP/LP overall reviews or ratings. Use \`/epeditreview\` for that.`,
	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
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
        let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

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

        if (rating == null && review == null && user_who_sent == null) return interaction.reply('You must supply either a rating change, a review change, or a user_who_sent change.');
        if (user_who_sent != null && user_who_sent != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_who_sent);
            taggedUser = taggedMember.user;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.reply(`Artist ${artistArray[i]} not found!`);
            songObj = db.reviewDB.get(artistArray[i])[songName];
            if (songObj == undefined) return interaction.reply(`Song ${songName} not found!`);
            songReviewObj = songObj[interaction.user.id];
            if (songReviewObj == undefined) return interaction.reply(`Review not found!`);

            if (rating != null && rating != undefined) {
                if (rating < 8 && songReviewObj.starred == true) {
                    return interaction.reply(`This review has a star on it, so you cannot change the rating to anything under 8.\nRemove the star with \`/setstar\` if you'd like to lower the rating!`);
                }
                
                oldrating = songReviewObj.rating;
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

        if (reviewMsgID != false) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    let msgEmbed = EmbedBuilder.from(msg.embeds[0]);

                    if (rating != null && rating != undefined) msgEmbed.data.fields[0].value = `**${rating}/10**`;
                    if (review != null && review != undefined) msgEmbed.setDescription(review);
                    if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: false })}` });

                    msg.edit({ embeds: [msgEmbed] });
                });
            }
        }

        let primArtist = artistArray[0];
        let epMsgToEdit = false;
        let epObj = false;

        for (let i = 0; i < artistArray.length; i++) {
            epObj = db.reviewDB.get(primArtist, db.reviewDB.get(primArtist)[songName].ep);
            if (epObj == undefined || epObj == false) break;
            if (epObj[interaction.user.id] == undefined || epObj[interaction.user.id] == false) break;
            epMsgToEdit = epObj[interaction.user.id].msg_id;
            if (epMsgToEdit != false && epMsgToEdit != undefined && epMsgToEdit != null) {
                primArtist = artistArray[i];
                break;
            } 
        }

        if (epObj != false && epObj != undefined) {
            if (epMsgToEdit != undefined && epMsgToEdit != false) {
                let displayArtists = origArtistArray.filter(v => v != primArtist);
                let channelsearch = await find_review_channel(interaction, interaction.user.id, epMsgToEdit);
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
                                msg_embed_fields[field_num].name = `🌟 ${displaySongName}${displayArtists.length != 0 ? ` (with ${displayArtists.join(' & ')})` : ``} (${rating}/10) 🌟`;
                            } else {
                                msg_embed_fields[field_num].name = `${displaySongName}${displayArtists.length != 0 ? ` (with ${displayArtists.join(' & ')})` : ``} (${rating}/10)`;
                            }
                        } 
                        if (review != null && review != undefined && msg_embed_fields[field_num].value != '*Review hidden to save space*') msg_embed_fields[field_num].value = review;

                        msg.edit({ embeds: [msgEmbed] });
                    }).catch(() => {});
                }
            } 
        }

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