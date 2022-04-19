const db = require("../db.js");
const { parse_artist_song_data, handle_error, hall_of_fame_check } = require('../func.js');
const wait = require('util').promisify(setTimeout);
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pushtoepreview')
        .setDescription('Push an existing review to an EP/LP review.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song.')
                .setAutocomplete(true)
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        try {
            let parsed_args = parse_artist_song_data(interaction);

            if (parsed_args == -1) {
                await wait(30000);
                try {
                    return interaction.deleteReply();
                } catch (err) {
                    return console.log(err);
                }
            }

            let origArtistArray = parsed_args[0];
            let artistArray = parsed_args[2];
            let songName = parsed_args[3];
            let rmxArtistArray = parsed_args[4];
            let vocalistArray = parsed_args[5];

            if (rmxArtistArray.length != 0) {
                artistArray = rmxArtistArray;
            } 

            let name = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].name`);
            if (name === undefined) {
                interaction.editReply(`No review found for \`${origArtistArray.join(' & ')} - ${songName}\`.`);
                await wait(30000);
                try {
                    return await interaction.deleteReply();
                } catch (err) {
                    return console.log(err);
                }
            } 
            let review = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].review`);
            let rating = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].rating`);
            let starred = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].starred`);
            let songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);

            let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review')[0];
            let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

            let msgEmbed;
            let mainArtists;
            let ep_name;
            let collab;
            let field_name;
            let type = db.user_stats.get(interaction.user.id, 'current_ep_review')[3]; // Type A is when embed length is under 2000 characters, type B is when its over 2000

            if (type == false || type == undefined || type == null) { // If there's not an active EP/LP review
                return interaction.editReply('You don\'t currently have an active EP/LP review, this command is supposed to be used with an EP/LP review started with `/epreview`!');
            }

            let displaySongName = (`${songName}` + 
            `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
            `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

            // Edit the EP embed
            await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                msgEmbed = msg.embeds[0];
                mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                mainArtists = mainArtists.flat(1);
                ep_name = msgEmbed.title.split(' - ');
                ep_name.shift();
                ep_name = ep_name.join(' - ');
                if (ep_name.includes('/10')) {
                    ep_name = ep_name.replace('/10)', '');
                    if (ep_name.includes('.5')) {
                        ep_name = ep_name.slice(0, -4).trim();
                    } else {
                        ep_name = ep_name.slice(0, -3).trim();
                    }
                }

                for (let j = 0; j < artistArray.length; j++) {
                    db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                }

                if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && songArt === false) {
                    songArt = msgEmbed.thumbnail.url;
                }

                collab = origArtistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                if (starred === true) {
                    field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                } else {
                    field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                }

                if (msgEmbed.length > 3250 && type == 'A') {
                    for (let j = 0; j < msgEmbed.fields.length; j++) {
                        msgEmbed.fields[j].value = `*Review hidden to save space*`;
                    }
                    db.user_stats.set(interaction.user.id, 'B', 'current_ep_review[3]');
                    type = 'B';
                }

                if (type == 'A') {
                    if (review.length <= 1000) {
                        msgEmbed.fields.push({
                            name: field_name,
                            value: `${review}`,
                            inline: false,
                        });
                    } else {
                        msgEmbed.fields.push({
                            name: field_name,
                            value: `*Review hidden to save space*`,
                            inline: false,
                        });
                    }
                } else {
                    msgEmbed.fields.push({
                        name: field_name,
                        value: `*Review hidden to save space*`,
                        inline: false,
                    });
                }

                msg.edit({ embeds: [msgEmbed], components: [] });

                // Star reaction stuff for hall of fame
                if (rating >= 8 && starred === true) {
                    for (let x = 0; x < artistArray.length; x++) {
                        db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                    }

                    db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                    hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                }
            }).catch(() => {
                channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                    msgEmbed = msg.embeds[0];
                    mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                    mainArtists = mainArtists.flat(1);
                    ep_name = msgEmbed.title.split(' - ');
                    ep_name.shift();
                    ep_name = ep_name.join(' - ');
                    if (ep_name.includes('/10')) {
                        ep_name = ep_name.replace('/10)', '');
                        if (ep_name.includes('.5')) {
                            ep_name = ep_name.slice(0, -4).trim();
                        } else {
                            ep_name = ep_name.slice(0, -3).trim();
                        }
                    }

                    for (let j = 0; j < artistArray.length; j++) {
                        db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                    }

                    if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && songArt === false) {
                        songArt = msgEmbed.thumbnail.url;
                    }

                    collab = artistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                    if (starred === true) {
                        field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                    } else {
                        field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                    }
                    
                    if (msgEmbed.length > 3250 && type == 'A') {
                        for (let j = 0; j < msgEmbed.fields.length; j++) {
                            msgEmbed.fields[j].value = `*Review hidden to save space*`;
                        }
                        db.user_stats.set(interaction.user.id, 'B', 'current_ep_review[3]');
                        type = 'B';
                    }

                    if (type == 'A') {
                        if (review.length <= 1000) {
                            msgEmbed.fields.push({
                                name: field_name,
                                value: `${review}`,
                                inline: false,
                            });
                        } else {
                            msgEmbed.fields.push({
                                name: field_name,
                                value: `*Review hidden to save space*`,
                                inline: false,
                            });
                        }
                    } else {
                        msgEmbed.fields.push({
                            name: field_name,
                            value: `*Review hidden to save space*`,
                            inline: false,
                        });
                    }

                    msg.edit({ embeds: [msgEmbed], components: [] });

                    // Star reaction stuff for hall of fame
                    if (rating >= 8 && starred === true) {
                        for (let x = 0; x < artistArray.length; x++) {
                            db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                        }

                        db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                        hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                    }
                });
            }).catch((err) => {
                handle_error(interaction, err);
            });

            // Update user stats
            db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

            for (let ii = 0; ii < mainArtists.length; ii++) {
                // Update EP details
                db.reviewDB.push(mainArtists[ii], songName, `["${ep_name}"].songs`);
            }

            // Set msg_id for this review to false, since its part of the EP review message
            for (let ii = 0; ii < artistArray.length; ii++) {
                db.reviewDB.set(artistArray[ii], false, `["${songName}"].["${interaction.user.id}"].msg_id`);
            }

            interaction.deleteReply();

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};
