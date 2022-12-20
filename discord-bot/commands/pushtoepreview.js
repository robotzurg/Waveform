const db = require("../db.js");
const { parse_artist_song_data, handle_error, hall_of_fame_check, find_review_channel } = require('../func.js');
const { ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle, Embed, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pushtoepreview')
        .setDescription('Push an existing review to an EP/LP review.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(false)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('song_name')
                .setDescription('The name of the song.')
                .setAutocomplete(false)
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
            let song = interaction.options.getString('song_name');
            let remixers = interaction.options.getString('remixers');
            let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
            if (song_info == -1) return interaction.deleteReply();

            let origArtistArray = song_info.prod_artists;
            let songName = song_info.song_name;
            let artistArray = song_info.all_artists;
            let vocalistArray = song_info.vocal_artists;
            let displaySongName = song_info.display_song_name;
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterSongName = songName.includes('.') ? `["${songName}"]` : songName;

            if (db.reviewDB.get(artistArray[0])[songName][interaction.user.id] == undefined) {
                return interaction.reply(`No review found for \`${origArtistArray.join(' & ')} - ${displaySongName}\`.`);
            } 

            let songObj = db.reviewDB.get(artistArray[0])[songName];
            let songReviewObj = songObj[interaction.user.id];

            let review = songReviewObj.review;
            let rating = songReviewObj.rating;
            let starred = songReviewObj.starred;
            let songArt = songObj.art;

            let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review.msg_id');
            let channelsearch = await find_review_channel(interaction, interaction.user.id, msgtoEdit);

            let msgEmbed;
            let mainArtists;
            let ep_name;
            let setterEpName;
            let ep_songs;
            let collab;
            let field_name;
            let type = db.user_stats.get(interaction.user.id, 'current_ep_review.review_type'); // Type A is when embed length is under 2000 characters, type B is when its over 2000
            let ep_last_song_button = new ActionRowBuilder()
            .addComponents( 
                new ButtonBuilder()
                .setCustomId('finish_ep_review')
                .setLabel('Finalize the EP/LP Review')
                .setStyle(ButtonStyle.Success),
            );

            if (type == false || type == undefined || type == null) { // If there's not an active EP/LP review
                return interaction.reply('You don\'t currently have an active EP/LP review, this command is supposed to be used with an EP/LP review started with `/epreview`!');
            }

            // Edit the EP embed
            await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                mainArtists = [msgEmbed.data.title.replace('🌟 ', '').trim().split(' - ')[0].split(' & ')];
                mainArtists = mainArtists.flat(1);
                ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name');
                // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
                setterEpName = ep_name.includes('.') ? `["${ep_name}"]` : ep_name;
                ep_songs = db.user_stats.get(interaction.user.id, 'current_ep_review.track_list');
                if (ep_songs == false) ep_songs = [];

                for (let j = 0; j < artistArray.length; j++) {
                    db.reviewDB.set(artistArray[j], ep_name, `${setterSongName}.ep`);
                }

                if (msgEmbed.data.thumbnail != undefined && msgEmbed.data.thumbnail != null && msgEmbed.data.thumbnail != false && songArt == false) {
                    songArt = msgEmbed.data.thumbnail.url;
                }

                collab = origArtistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                if (starred == true) {
                    field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``} 🌟`;
                } else {
                    field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``}`;
                }

                // If the entire EP/LP review is over 5250 characters, set EP/LP review type to "B" (aka hide any more reviews from that point)
                if (new Embed(msgEmbed.toJSON()).length > 5250 && type == 'A') {
                    db.user_stats.set(interaction.user.id, 'B', 'current_ep_review.review_type');
                    type = 'B';
                }

                // Check what review type we are and add in reviews to the EP/LP review message accordingly
                if (type == 'A') {
                    if (review.length <= 1000) {
                        msgEmbed.addFields({
                            name: field_name,
                            value: `${review}`,
                            inline: false,
                        });
                    } else {
                        msgEmbed.addFields({
                            name: field_name,
                            value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                            inline: false,
                        });
                    }
                } else {
                    msgEmbed.addFields({
                        name: field_name,
                        value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                        inline: false,
                    });
                }

                if (ep_songs[ep_songs.length - 1] == songName) {
                    msg.edit({ embeds: [msgEmbed], components: [ep_last_song_button] });

                    const ep_final_filter = int => int.user.id == interaction.user.id;
                    let ep_final_collector = interaction.channel.createMessageComponentCollector({ filter: ep_final_filter, max: 1, time: 60000 });

                    ep_final_collector.on('collect', async () => {
                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                        msg.edit({ components: [] });
                    });

                    ep_final_collector.on('end', async () => {
                        msg.edit({ components: [] });
                    });

                } else {
                    msg.edit({ embeds: [msgEmbed], components: [] });
                }

                // Star reaction stuff for hall of fame
                if (rating >= 8 && starred == true) {
                    for (let x = 0; x < artistArray.length; x++) {
                        db.reviewDB.set(artistArray[x], true, `${setterSongName}.${interaction.user.id}.starred`);
                    }

                    db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                    hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                }
            });

            // Update user stats
            db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

            for (let ii = 0; ii < mainArtists.length; ii++) {
                // Update EP details
                db.reviewDB.push(mainArtists[ii], songName, `${setterEpName}.songs`);
            }

            // Set msg_id for this review to false, since its part of the EP review message
            for (let ii = 0; ii < artistArray.length; ii++) {
                db.reviewDB.set(artistArray[ii], false, `${setterSongName}.${interaction.user.id}.msg_id`);
            }

            interaction.reply({ content: 'Pushed to the EP/LP review successfully.', ephemeral: true });

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};
