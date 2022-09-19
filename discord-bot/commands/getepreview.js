const db = require("../db.js");
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { handle_error, find_review_channel, parse_artist_song_data } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getepreview')
        .setDescription('Get an EP review from a user on the server that they have written!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false)),
    admin: false,
	async execute(interaction) {

        try {
            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info == -1) return;

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            let artistArray = song_info.all_artists;
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let taggedUser = interaction.options.getUser('user');
            let taggedMember = interaction.member;

            if (taggedUser != null) {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            } else {
                taggedUser = interaction.user;
                taggedMember = interaction.member;
            }

            if (!epName.includes(' EP') && !epName.includes(' LP')) epName = `${epName} EP`;

            let artistsEmbed;
            let vocalistsEmbed;
            let rreview;
            let rscore;
            let rsentby = false;
            let rstarred;

            let epObj = db.reviewDB.get(artistArray[0], `["${epName}"]`);
            if (epObj == undefined) return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` was not found in the database.`);

            let user_name = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].name`);
            if (user_name == undefined) return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` has not been reviewed by the user ${taggedMember.displayName}.`);

            let ep_overall_rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].rating`);
            let ep_overall_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].review`);
            let no_songs_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].no_songs`);
            let ep_sent_by = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].sentby`);
            if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
            let ep_url = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].url`);
            let ep_starred = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].starred`);

            let ep_art = db.reviewDB.get(artistArray[0], `${epName}.art`);
            let ep_songs = db.reviewDB.get(artistArray[0], `${epName}.songs`);
            if (ep_songs == false || ep_songs == undefined) ep_songs = [];

            if (ep_art == false) {
                ep_art = taggedUser.avatarURL({ extension: "png" });
            }

            if (ep_sent_by != undefined && ep_sent_by != false) {
                ep_sent_by = await interaction.guild.members.fetch(ep_sent_by);
            }

            const epEmbed = new EmbedBuilder();
            
            epEmbed.setColor(`${taggedMember.displayHexColor}`);
            epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName}` : `🌟 ${origArtistArray.join(' & ')} - ${epName} 🌟`);

            if (ep_overall_rating !== false && ep_overall_review != false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbed.addFields([{ name: `Rating`, value: `**${ep_overall_rating}/10**` }]);
                }
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            } else if (ep_overall_rating !== false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbed.addFields([{ name: `Rating`, value: `**${ep_overall_rating}/10**` }]);
                }
            } else if (ep_overall_review != false) {
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            }

            epEmbed.setAuthor({ name: rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${taggedMember.displayName}'s mailbox ${epType} review` : `${taggedMember.displayName}'s ${epType} review`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: false })}` });

            epEmbed.setThumbnail(ep_art);
            if (ep_sent_by != false && ep_sent_by != undefined) {
                epEmbed.setFooter({ text: `Sent by ${ep_sent_by.displayName}`, iconURL: `${ep_sent_by.user.avatarURL({ extension: "png" })}` });
            }

            let reviewMsgID = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].msg_id`);
            if (reviewMsgID != false && reviewMsgID != undefined) {
                let channelsearch = await find_review_channel(interaction, taggedUser.id, reviewMsgID);
                if (channelsearch != undefined) {
                    await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                        epEmbed.setTimestamp(msg.createdTimestamp);
                    });
                }
            }

            if (ep_songs.length != 0) {
                for (let i = 0; i < ep_songs.length; i++) {
                    let songName = ep_songs[i];
                    artistsEmbed = [];
                    vocalistsEmbed = [];

                    rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
                    if (rreview.length > 1000) rreview = '*Review hidden to save space*';
                    rscore = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`);
                    rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
                    rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);

                    // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
                        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                            artistsEmbed = [];
                            artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                            artistsEmbed = artistsEmbed.flat(1);
                            artistsEmbed = artistsEmbed.join(' & ');
                        }
                    }
            
                    if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
                        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                            vocalistsEmbed = [];
                            vocalistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                            vocalistsEmbed = vocalistsEmbed.flat(1);
                            vocalistsEmbed = vocalistsEmbed.join(' & ');
                        }
                    }

                    if (epEmbed.length < 3250) {
                        epEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                        `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                        `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                        `${rscore != false ? `(${rscore}/10)` : ``}`, 
                        value: `${rreview == false ? `*No review written*` : `${rreview}`}` }]);
                    } else {
                        epEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                        `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                        `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                        `${rscore != false ? `(${rscore}/10)` : ``}`, 
                        value: `${rreview == false ? `*No review written*` : `*Review hidden to save space*`}` }]);
                    }
                }
            }

            if (ep_url) {
                interaction.reply({ content: `[View ${epType} Review Message](${ep_url})`, embeds: [epEmbed] });
            } else {
                interaction.reply({ embeds: [epEmbed] });
            }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }

	},
};