const Discord = require('discord.js');
const db = require("../db.js");
const { get_user_reviews, handle_error, spotify_api_setup } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getartistratings')
        .setDescription('Get all the songs from an artist and display them in an embed message.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(true))
        
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user who you would like to use for this command (defaults to yourself)')
                .setRequired(false)),

    admin: false,
	async execute(interaction) {
        try {

        let spotifyCheck;
        let isPodcast;
        let artist = interaction.options.getString('artist');

        let taggedUser = interaction.options.getUser('user');
        let taggedMember;

        if (taggedUser != null) {
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        } else {
            taggedMember = interaction.member;
            taggedUser = interaction.user;
        }
        
        // Spotify Check
        if (artist == null) {
            const spotifyApi = await spotify_api_setup(interaction.user.id);
            if (spotifyApi == false) return interaction.editReply(`This subcommand requires you to use \`/login\` `);

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                artist = data.body.item.artists.map(a => a.name)[0];
                spotifyCheck = true;
            });

            // Check if a podcast is being played, as we don't support that.
            if (isPodcast == true) {
                return interaction.editReply('Podcasts are not supported with `/np`.');
            }
        }

        if (spotifyCheck == false && (artist.toLowerCase() == 's')) {
            return interaction.editReply('Spotify playback not detected, please type in the artist name manually or play a song!');
        }

        const artistObj = db.reviewDB.get(artist);
        if (artistObj == undefined) return interaction.editReply('Artist not found in the database.');
        let songArray = Object.keys(artistObj);
        let songObj;
        let reviewObj = {};
        let reviewedArray = [];
        let userArray = [];
        let avg = 0;
        songArray = songArray.filter(item => item !== 'Image');
        songArray = songArray.map(item => item.replace('\\', '\\\\'));

        for (let i = 0; i < songArray.length; i++) {
            songObj = db.reviewDB.get(artist, `["${songArray[i]}"]`);
            userArray = get_user_reviews(songObj);
            userArray = userArray.filter(item => item == taggedUser.id);
            if (userArray.length != 0) {
                if (songObj[taggedUser.id].rating != undefined && songObj[taggedUser.id].rating != null) {
                    if (songObj[taggedUser.id].starred == false) {
                        reviewObj[songArray[i]] = parseFloat(songObj[taggedUser.id].rating);
                    } else {
                        reviewObj[`🌟 ${songArray[i]}`] = parseFloat(songObj[taggedUser.id].rating) + 1;
                    }
                }
            } else {
                reviewObj[songArray[i]] = -2;
            }

            if (isNaN(reviewObj[songArray[i]]) && reviewObj[songArray[i]] != undefined) reviewObj[songArray[i]] = -1; 
        }

        reviewedArray = Object.entries(reviewObj).sort((a, b) => b[1] - a[1]);
        let avgArray = [];

        for (let i = 0; i < reviewedArray.length; i++) {
            if (reviewedArray[i][1] > 10) {
                reviewedArray[i][1] -= 1;
                avgArray.push(reviewedArray[i][1]);
            } else if (reviewedArray[i][1] == -1) {
                reviewedArray[i][1] = 'No Rating Given';
            } else if (reviewedArray[i][1] == -2) {
                reviewedArray[i][1] = 'No Review';
            } else {
                avgArray.push(reviewedArray[i][1]);
            }
        }

        avg = _.mean(avgArray).toFixed(2);
        if (isNaN(avg)) avg = 'N/A';

        let pagedReviewList = _.chunk(reviewedArray, 10);
        let page_num = 0;
        const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('left')
                .setStyle('PRIMARY')
                .setEmoji('⬅️'),
            new Discord.MessageButton()
                .setCustomId('right')
                .setStyle('PRIMARY')
                .setEmoji('➡️'),
        );

        for (let i = 0; i < pagedReviewList.length; i++) {

            for (let j = 0; j < pagedReviewList[i].length; j++) {
                pagedReviewList[i][j] = `• **[${pagedReviewList[i][j][0]}](<https://www.google.com>):** \`${pagedReviewList[i][j][1]}\``;
            }

            pagedReviewList[i] = pagedReviewList[i].join('\n');
        }  

        const ratingListEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(taggedUser.avatarURL({ format: "png" }))
            .setAuthor({ name: `All ratings for ${artist} by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ format: "png" }) })
            .addField(`Average Rating`, `${avg}`, true)
            .addField(`Songs`, `${pagedReviewList[page_num]}`, false);
            if (pagedReviewList.length > 1) {
                ratingListEmbed.setFooter({ text: `Page 1 / ${pagedReviewList.length}` });
                interaction.editReply({ embeds: [ratingListEmbed], components: [row] });
            } else {
                interaction.editReply({ embeds: [ratingListEmbed], components: [] });
            }
        
        if (pagedReviewList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedReviewList.length - 1);
                ratingListEmbed.fields[1] = { name: `Songs`, value: pagedReviewList[page_num] };
                ratingListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedReviewList.length}` });
                i.update({ embeds: [ratingListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [ratingListEmbed], components: [] });
            });

        }

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};
