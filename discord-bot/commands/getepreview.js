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
            if (artistObj === undefined) {
                return interaction.editReply('No artist found.');
            }

            let artistsEmbed;
            let vocalistsEmbed;
            let rname;
            let rreview;
            let rscore;
            let rsentby = false;
            let rstarred;
            let usrSentBy = interaction.author;

            const ep_object = db.reviewDB.get(artistArray[0], `${epName}`);
            if (ep_object === undefined) return interaction.editReply('EP not found. *(EP Object not found in database.)*');
            const ep_overall_rating = parseInt(db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].rating`));
            const ep_overall_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].review`);
            let ep_ranking = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].ranking`);
            let ep_url = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].url`);
            if (ep_ranking === undefined) ep_ranking = []; // This is handling for any odd scenarios where this never gets set

            let ep_art = db.reviewDB.get(artistArray[0], `${epName}.art`);
            let ep_songs = db.reviewDB.get(artistArray[0], `${epName}.songs`);
            if (ep_songs === false || ep_songs === undefined) ep_songs = [];
            rname = db.reviewDB.get(artistArray[0], `${epName}.${taggedUser.id}.name`);

            if (ep_art === false) {
                ep_art = taggedUser.avatarURL({ format: "png" });
            }

            const epEmbed = new Discord.MessageEmbed();
            if (ep_songs.length != 0) {
                for (let i = 0; i < ep_songs.length; i++) {
                    let songName = ep_songs[i];
                    artistsEmbed = [];
                    vocalistsEmbed = [];

                    rname = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].name`);
                    if (rname === undefined) return interaction.editReply(`No review found for song ${songName}`);
                    rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
                    rscore = `${db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`)}/10`;
                    rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
                    rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);
                    if (rsentby != false) {
                        usrSentBy = interaction.guild.members.cache.get(rsentby);              
                    }

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

                    epEmbed.addField(`${rstarred === true ? `🌟 ${songName} 🌟` : songName }${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}(${rscore})`, `${rreview}`);
                }
            }
            
            epEmbed.setColor(`${taggedMember.displayHexColor}`);
            epEmbed.setTitle(`${origArtistArray} - ${epName}`);
            epEmbed.setAuthor(rsentby != false ? `${rname}'s mailbox review` : `${rname}'s review`, `${taggedUser.avatarURL({ format: "png" })}`);

            if (ep_overall_rating != false && ep_overall_review != false) {
                epEmbed.setTitle(`${origArtistArray} - ${epName} (${ep_overall_rating}/10)`);
                epEmbed.setDescription(`*${ep_overall_review}*`);
            } else if (ep_overall_rating != false) {
                epEmbed.setTitle(`${origArtistArray} - ${epName} (${ep_overall_rating}/10)`);
            } else if (ep_overall_review != false) {
                epEmbed.setDescription(`*${ep_overall_review}*`);
            }

            if (epName.includes('EP')) {
                epEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox EP review` : `${rname}'s EP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            } else if (epName.includes('LP')) {
                epEmbed.setAuthor(rsentby != false && rsentby != undefined && ep_songs.length != 0 ? `${rname}'s mailbox LP review` : `${rname}'s LP review`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }
            epEmbed.setThumbnail(ep_art);
            if (rsentby != false && rsentby != undefined && ep_overall_rating === false) {
                epEmbed.setFooter(`Sent by ${usrSentBy.displayName}`, `${usrSentBy.user.avatarURL({ format: "png" })}`);
            }

            let reviewMsgID = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].msg_id`);
                if (reviewMsgID != false && reviewMsgID != undefined) {
                    let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                    await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                        epEmbed.setTimestamp(msg.createdTimestamp);
                    }).catch(() => {
                        channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                        channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                            epEmbed.setTimestamp(msg.createdTimestamp);
                        }).catch(() => {});
                    });
                }
            
            if (ep_url === undefined) {
                interaction.editReply({ embeds: [epEmbed] });
            } else {
                interaction.editReply({ content: `[View EP/LP Review Message](${ep_url})`, embeds: [epEmbed] });
            }

            if (db.reviewDB.get(artistArray[0], `["${epName}"].["${interaction.user.id}"]`) != undefined) {
                if (ep_ranking.length != 0) {
                    const rankingEmbed = new Discord.MessageEmbed()
                    .setColor(`${taggedMember.displayHexColor}`);

                    ep_ranking = ep_ranking.sort(function(a, b) {
                        return a[0] - b[0];
                    });
        
                    ep_ranking = ep_ranking.flat(1);
        
                    for (let ii = 0; ii <= ep_ranking.length; ii++) {
                        ep_ranking.splice(ii, 1);
                    }

                    rankingEmbed.addField(`Ranking:`, `\`\`\`${ep_ranking.join('\n')}\`\`\``);

                    interaction.channel.send({ embeds: [rankingEmbed] });
                } 
            }

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }

	},
};