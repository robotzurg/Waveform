const Discord = require('discord.js');
const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getepreview')
        .setDescription('Get an EP review from a user on the server that they have written!')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP.')
                .setAutocomplete(true)
                .setRequired(true))
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false)),
    admin: false,
	async execute(interaction) {

        try {

            let origArtistArray = interaction.options.getString('artist').split(' & ');
            let epName = interaction.options.getString('ep_name');
            let taggedUser = interaction.options.getUser('user');
            let taggedMember = interaction.member;

            if (taggedUser != null) {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            } else {
                taggedUser = interaction.user;
                taggedMember = interaction.member;
            }

            let artistArray = origArtistArray;

            if (!epName.includes(' EP') && !epName.includes(' LP')) epName = `${epName} EP`;

            const artistObj = db.reviewDB.get(artistArray[0]);
            if (artistObj == undefined) {
                return interaction.editReply('No artist found.');
            }

            let artistsEmbed;
            let vocalistsEmbed;
            let rreview;
            let rscore;
            let rsentby = false;
            let rstarred;
            let ratingArray = [];

            const ep_object = db.reviewDB.get(artistArray[0], `${epName}`);
            if (ep_object == undefined) return interaction.editReply('EP/LP not found.');

            let ep_name = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].name`);
            if (ep_name == undefined) return interaction.editReply(`This EP/LP has not been reviewed by the user ${taggedMember.displayName}.`);

            let ep_overall_rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].rating`);
            let ep_overall_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].review`);
            let no_songs_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].no_songs`);
            let ep_sent_by = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].sentby`);
            if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
            let ep_ranking = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].ranking`);
            let ep_url = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].url`);
            if (ep_ranking == undefined) ep_ranking = []; // This is handling for any odd scenarios where this never gets set
            let ep_starred = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].starred`);

            let ep_art = db.reviewDB.get(artistArray[0], `${epName}.art`);
            let ep_songs = db.reviewDB.get(artistArray[0], `${epName}.songs`);
            if (ep_songs == false || ep_songs == undefined) ep_songs = [];

            if (ep_art == false) {
                ep_art = taggedUser.avatarURL({ format: "png" });
            }

            if (ep_sent_by != undefined && ep_sent_by != false) {
                ep_sent_by = await interaction.guild.members.fetch(ep_sent_by);
            }

            const epEmbed = new Discord.MessageEmbed();
            if (ep_songs.length != 0) {
                for (let i = 0; i < ep_songs.length; i++) {
                    let songName = ep_songs[i];
                    artistsEmbed = [];
                    vocalistsEmbed = [];

                    rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
                    if (rreview.length > 1000) rreview = '*Review hidden to save space*';
                    rscore = `${db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`)}/10`;
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

                    ratingArray.push(rscore);
                    epEmbed.addField(`${rstarred == true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}(${rscore})`, `${rreview}`);
                }
            }
            
            epEmbed.setColor(`${taggedMember.displayHexColor}`);
            epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName}` : `🌟 ${origArtistArray.join(' & ')} - ${epName} 🌟`);

            if (ep_overall_rating != false && ep_overall_review != false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbed.addField(`Rating`, `**${ep_overall_rating}/10**`);
                }
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            } else if (ep_overall_rating != false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbed.addField(`Rating`, `**${ep_overall_rating}/10**`);
                }
            } else if (ep_overall_review != false) {
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            }

            if (epName.includes('EP')) {
                epEmbed.setAuthor({ name: rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${taggedMember.displayName}'s mailbox EP review` : `${taggedMember.displayName}'s EP review`, iconURL: `${taggedUser.avatarURL({ format: "png", dynamic: false })}` });
            } else if (epName.includes('LP')) {
                epEmbed.setAuthor({ name: rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${taggedMember.displayName}'s mailbox LP review` : `${taggedMember.displayName}'s LP review`, iconURL: `${taggedUser.avatarURL({ format: "png", dynamic: false })}` });
            }
            epEmbed.setThumbnail(ep_art);
            if (ep_sent_by != false && ep_sent_by != undefined) {
                epEmbed.setFooter(`Sent by ${ep_sent_by.displayName}`, `${ep_sent_by.user.avatarURL({ format: "png" })}`);
            }

            let reviewMsgID = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].msg_id`);
            if (reviewMsgID != false && reviewMsgID != undefined) {
                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                    epEmbed.setTimestamp(msg.createdTimestamp);
                }).catch(() => {
                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                    if (channelsearch != undefined) {
                        channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                            epEmbed.setTimestamp(msg.createdTimestamp);
                        }).catch(() => {});
                    }
                });
            }
            
            if (epEmbed.length > 3250) {
                for (let i = 0; i < epEmbed.fields.length; i++) {
                    epEmbed.fields[i].value = `*Review hidden to save space*`;
                }
            }

            if (ep_url) {
                interaction.editReply({ content: `[View EP/LP Review Message](${ep_url})`, embeds: [epEmbed] });
            } else {
                interaction.editReply({ embeds: [epEmbed] });
            }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }

	},
};