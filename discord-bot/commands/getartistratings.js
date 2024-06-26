const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const db = require("../db.js");
const { get_user_reviews, handle_error, spotify_api_setup, getEmbedColor, convertToSetterName } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getartistratings')
        .setDescription('Get all of a users ratings of an artists songs.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setAutocomplete(true)
                .setRequired(false))
        
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user who you would like to use for this command (defaults to yourself)')
                .setRequired(false)),

    help_desc: `Displays all ratings you have given to an artists, and what songs you haven't rated from the given artist.\n\n` +
    `Leaving the artist argument blank will pull from your spotify playback to fill in the argument (if logged in to Waveform with Spotify)\n\n` +
    `Putting in a user into the user argument will allow you to view another users ratings of the specified artist, otherwise leaving it blank will default to yourself.`,
	async execute(interaction, client, serverConfig) {
        try {

        if (serverConfig.disable_ratings === true) {
            return interaction.reply('This command has been disabled due to the rating system being disabled on this server.\nFor more information, please contact your servers admins.');
        }

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
            if (spotifyApi == false) return interaction.reply(`This subcommand requires you to use \`/login\` `);

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                artist = data.body.item.artists.map(a => a.name.replace(' & ', ' \\& '))[0];
                spotifyCheck = true;
            });

            // Check if a podcast is being played, as we don't support that.
            if (isPodcast == true) {
                return interaction.reply('Podcasts are not supported with `/np`.');
            }
        }

        if (spotifyCheck == false) {
            return interaction.reply('Spotify playback not detected, please type in the artist name manually or play a song!');
        }

        const artistObj = db.reviewDB.get(artist);
        if (artistObj == undefined) return interaction.reply(`${artist} was not found in the database.`);
        let songArray = Object.keys(artistObj);
        songArray = songArray.map(v => v = v.replace('_((', '[').replace('))_', ']'));
        let songObj;
        let reviewObj = {};
        let reviewedArray = [];
        let userArray = [];
        let avg = 0;
        songArray = songArray.filter(item => item !== 'pfp_image');

        for (let i = 0; i < songArray.length; i++) {
            let setterSongName = convertToSetterName(songArray[i]);
            songObj = db.reviewDB.get(artist, `${setterSongName}`);
            userArray = await get_user_reviews(songObj, serverConfig.disable_global, interaction.guild);
            userArray = userArray.filter(item => item == taggedUser.id);
            if (userArray.length != 0) {
                if (songObj[taggedUser.id].rating != undefined && songObj[taggedUser.id].rating != null) {
                    if (songObj[taggedUser.id].starred == false) {
                        reviewObj[songArray[i]] = parseFloat(songObj[taggedUser.id].rating);
                    } else {
                        reviewObj[`🌟 ${songArray[i]}`] = parseFloat(songObj[taggedUser.id].rating) + 100;
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
                reviewedArray[i][1] = reviewedArray[i][1] - 100;
                reviewedArray[i][1] = Math.round(reviewedArray[i][1] * 10) / 10;
                avgArray.push(reviewedArray[i][1]);
            } else if (reviewedArray[i][1] == -1) {
                reviewedArray[i][1] = 'No Rating Given';
            } else if (reviewedArray[i][1] == -2) {
                reviewedArray[i][1] = 'No Review';
            } else {
                avgArray.push(reviewedArray[i][1]);
            }
        }

        avg = `${Math.round(_.mean(avgArray) * 100) / 100}`;
        if (isNaN(avg)) avg = 'N/A';

        let pagedReviewList = _.chunk(reviewedArray, 10);
        let page_num = 0;
        const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('left')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⬅️'),
            new ButtonBuilder()
                .setCustomId('right')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️'),
        );

        for (let i = 0; i < pagedReviewList.length; i++) {

            for (let j = 0; j < pagedReviewList[i].length; j++) {
                pagedReviewList[i][j] = `• **[${pagedReviewList[i][j][0]}](<https://www.google.com>):** \`${pagedReviewList[i][j][1]}\``;
            }

            pagedReviewList[i] = pagedReviewList[i].join('\n');
        }  

        const ratingListEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(taggedMember)}`)
            .setThumbnail(taggedUser.avatarURL({ extension: "png" }))
            .setAuthor({ name: `All ratings for ${artist} by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ extension: "png" }) })
            .addFields([
                { name: `Average Rating`, value: avg, inline: true },
                { name: `Music`, value: pagedReviewList[page_num], inline: false },
            ]);
            if (pagedReviewList.length > 1) {
                ratingListEmbed.setFooter({ text: `Page 1 / ${pagedReviewList.length}` });
                interaction.reply({ embeds: [ratingListEmbed], components: [row] });
            } else {
                interaction.reply({ embeds: [ratingListEmbed], components: [] });
            }
        
        if (pagedReviewList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedReviewList.length - 1);
                ratingListEmbed.data.fields[1] = { name: `Songs`, value: pagedReviewList[page_num] };
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
            handle_error(interaction, client, error);
        }
	},
};
