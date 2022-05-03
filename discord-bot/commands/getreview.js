const Discord = require('discord.js');
const db = require("../db.js");
const { parse_artist_song_data, handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getreview')
        .setDescription('Get a review someone has written in the database!')
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
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false))

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
                return;
            }

            let origArtistArray = parsed_args[0];
            let artistArray = parsed_args[2];
            let songName = parsed_args[3];
            let rmxArtistArray = parsed_args[4];
            let vocalistArray = parsed_args[5];

            if (rmxArtistArray.length != 0) {
                artistArray = rmxArtistArray;
            } 

            if (!db.reviewDB.has(artistArray[0])) {
                return interaction.editReply(`The artist \`${artistArray[0]}\` was not found in the database.`);
            }

            let taggedUser = interaction.options.getUser('user');
            let taggedMember;
            if (taggedUser == null) {
                taggedUser = interaction.user;
                taggedMember = interaction.member;
            } else {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            }

            let rname;
            let rreview;
            let rscore;
            let rsentby;
            let rstarred;
            let rurl;
            let usrSentBy;
            let rtimestamp;
            let epfrom = db.reviewDB.get(artistArray[0], `["${songName}"].ep`);
            let songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);

            rname = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].name`);
            if (rname == undefined) return interaction.editReply(`No review found for \`${origArtistArray.join(' & ')} - ${songName}\`. *Note that for EP reviews, you need to use \`/getReviewEP\`.*`);
            rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
            rscore = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`);
            rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
            rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);
            rurl = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].url`);
            if (rsentby != false) {
                usrSentBy = await interaction.guild.members.cache.get(rsentby);              
            }
            
            if (songArt != false) {
                songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
            } else {
                songArt = taggedUser.avatarURL({ format: "png" });
            }

            if (rreview == 'No written review.' || rreview == "This was from a ranking, so there is no written review for this song.") rreview = '-';

            const reviewEmbed = new Discord.MessageEmbed()
            .setColor(`${taggedMember.displayHexColor}`);

            if (rstarred == false) {
                reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray})` : ``}`);
            } else {
                reviewEmbed.setTitle(`:star2: ${origArtistArray.join(' & ')} - ${songName}${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray})` : ``} :star2:`);
            }

            reviewEmbed.setAuthor({ name: `${taggedMember.displayName}'s review`, iconURL: `${taggedUser.avatarURL({ format: "png" })}` });

            if (rreview != '-') {
                reviewEmbed.setDescription(`${rreview}`);
            } else {
                reviewEmbed.setDescription(`Rating: **${rscore}/10**`);
            }

            let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].msg_id`);
            if (reviewMsgID != false && reviewMsgID != undefined) {
                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                    reviewEmbed.setTimestamp(msg.createdTimestamp);
                }).catch(() => {
                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(taggedUser.id, 'mailbox'));
                    if (channelsearch != undefined) {
                        channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                            reviewEmbed.setTimestamp(msg.createdTimestamp);
                        }).catch(() => {}); // No error handling here as this is to make sure that legacy reviews go through okay, if they have msg_id false.
                    }
                });
            }

            reviewEmbed.setThumbnail((songArt == false) ? interaction.user.avatarURL({ format: "png" }) : songArt);
            if (rreview != '-') reviewEmbed.addField('Rating: ', `**${rscore}/10**`, true);

            if (rsentby != false) {
                reviewEmbed.setFooter({ text: `Sent by ${usrSentBy.displayName}`, iconURL: `${usrSentBy.user.avatarURL({ format: "png" })}` });
            } else if (epfrom != undefined && epfrom != false) {
                reviewEmbed.setFooter({ text: `from ${epfrom}`, iconURL: db.reviewDB.get(artistArray[0], `["${epfrom}"].art`) });
            }
            
            console.log(rurl);

            if ((rurl == undefined && rtimestamp == undefined) || rurl == false) {
                interaction.editReply({ embeds: [reviewEmbed] });
            } else {
                interaction.editReply({ content: `[View Review Message](${rurl})`, embeds: [reviewEmbed] });
            }
        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};
