const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { parse_artist_song_data, handle_error, find_review_channel } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editreview')
        .setDescription('Edit a song review.')
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Edit/add data to a song review with spotify playback data.')

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The new rating of the review.')
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The new written review.')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('The new user who sent you the song for the review')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Edit/add data to a song review with manually entered information.')

            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The artists of the song you would like to edit the review of (No Remixers Here).')
                    .setAutocomplete(true)
                    .setRequired(true))
    
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The song you would like to edit the review of.')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('The new rating of the review.')
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('review')
                    .setDescription('The new written review.')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('The new user who sent you the song for the review')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Remixers that remixed the song you are editing the review of.')
                    .setAutocomplete(true)
                    .setRequired(false))),

	async execute(interaction) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info == -1) return;

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.all_artists;
        let displaySongName = song_info.display_song_name;

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
        let old_user_who_sent;
        let user_sent_name;

        if (rating == null && review == null && user_who_sent == null) return interaction.editReply('You must supply either a rating change, a review change, or a user_who_sent change.');

        if (user_who_sent != null && user_who_sent != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_who_sent);
            taggedUser = taggedMember.user;
        }

        if (!db.reviewDB.has(artistArray[0])) return interaction.editReply(`Artist ${artistArray[0]} not found!`);

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`Artist ${artistArray[i]} not found!`);
            if (!db.reviewDB.get(artistArray[i], songName) == undefined) return interaction.editReply(`Song ${songName} not found!`);
            if (!db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"]`) == undefined) return interaction.editReply(`Review not found!`);

            if (rating != null && rating != undefined) {
                if (rating < 8 && db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].starred`) == true) {
                    return interaction.editReply(`This review has a star on it, so you cannot change the rating to anything under 8.\nRemove the star with \`/setstar\` if you'd like to lower the rating!`);
                }
                
                oldrating = db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].rating`);
                db.reviewDB.set(artistArray[i], parseFloat(rating), `["${songName}"].["${interaction.user.id}"].rating`);
            } 

            if (review != null && review != undefined) {
                oldreview = db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].review`);
                db.reviewDB.set(artistArray[i], review, `["${songName}"].["${interaction.user.id}"].review`);
            }

            if (user_who_sent != null && user_who_sent != undefined) {
                old_user_who_sent = db.reviewDB.set(artistArray[i], user_who_sent.id, `["${songName}"].["${interaction.user.id}"].user_who_sent`);
                user_sent_name = await interaction.guild.members.fetch(user_who_sent);
                db.reviewDB.set(artistArray[i], user_who_sent.id, `["${songName}"].["${interaction.user.id}"].user_who_sent`);
            }
        }

        let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].msg_id`);

        if (reviewMsgID != false) {
            let channelsearch = await find_review_channel(interaction, interaction.user.id, reviewMsgID);
            if (channelsearch != undefined) {
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    let embed_data = msg.embeds;
                    let msgEmbed = embed_data[0];

                    if (rating != null && rating != undefined) msgEmbed.fields[0].value = `**${rating}/10**`;
                    if (review != null && review != undefined) msgEmbed.setDescription(review);
                    if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);

                    msg.edit({ embeds: [msgEmbed] });
                });
            }
        }

        let primArtist = artistArray[0];
        let epMsgToEdit = false;
        let ep_from = false;

        for (let i = 0; i < artistArray.length; i++) {
            ep_from = db.reviewDB.get(primArtist, `["${songName}"].ep`);
            epMsgToEdit = db.reviewDB.get(artistArray[i], `["${ep_from}"].["${interaction.user.id}"].msg_id`);
            if (epMsgToEdit != false && epMsgToEdit != undefined && epMsgToEdit != null) {
                primArtist = artistArray[i];
                break;
            } 
        }

        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(primArtist, `["${ep_from}"].["${interaction.user.id}"]`) != undefined) {
                let displayArtists = origArtistArray.filter(v => v != primArtist);
                let channelsearch = await find_review_channel(interaction, interaction.user.id, epMsgToEdit);
                if (channelsearch != undefined) {
                    channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                        let msgEmbed = msg.embeds[0];
                        let msg_embed_fields = msgEmbed.fields;
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

        interaction.editReply(`Here's what was edited on your review of **${origArtistArray.join(' & ')} - ${displaySongName}**:\n` +
        `${(oldrating != undefined) ? `\`${oldrating}/10\` changed to \`${rating}/10\`\n` : ``}` +
        `${(oldreview != undefined) ? `Review was changed to \`${review}\`\n` : ``}` +
        `${(old_user_who_sent != undefined) ? `User Who Sent was changed to \`${user_sent_name.displayName}\`` : ``}`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};