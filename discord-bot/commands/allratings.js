const db = require("../db.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const { get_user_reviews, handle_error } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allratings')
        .setDescription('View a list of all ratings a user has given.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose list you want to see. Defaults to yourself.')
                .setRequired(false)),
    help_desc: `Gets a full list of every rating a specified user has given, and how many times they have given that rating.`,
	async execute(interaction) {

        try {

        await interaction.reply('Loading rating list, this takes a moment so please be patient!');

        let taggedUser = interaction.options.getUser('user');
        let taggedMember;

        if (taggedUser != null) {
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        } else {
            taggedMember = interaction.member;
            taggedUser = interaction.user;
        }

        let artistCount = [];
        let songSkip = [];
        let ratingList = {};
        let ratingCount = 0;

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let artistObj = db.reviewDB.get(artistArray[i]);
            let songArray = Object.keys(artistObj);
            songArray = songArray.filter(v => v != 'Image');

            for (let j = 0; j < songArray.length; j++) {
                let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                let userArray = get_user_reviews(songObj);
                userArray = userArray.filter(v => v == taggedUser.id);
                if (userArray.length != 0) artistCount.push(artistArray[i]);
                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                let collabArray = songObj.collab;
                let vocalistArray = songObj.vocals;
                if (collabArray == undefined) collabArray = [];
                if (vocalistArray == undefined) vocalistArray = [];

                collabArray = collabArray.filter(v => !vocalistArray.includes(v));
                let otherArtists = [artistArray[i], collabArray].flat(1);
                let allArtists = otherArtists.map(v => {
                    if (v == undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);

                for (let k = 0; k < userArray.length; k++) {
                    let userData = songObj[userArray[k]];
                    if (userData.rating == undefined || userData.rating == null) continue;
                    ratingCount += 1;
                    userData.rating = userData.rating.toString();
                    if (!(userData.rating in ratingList)) {
                        ratingList[userData.rating] = 1;
                    } else {
                        ratingList[userData.rating] += 1;
                    }
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                    }
                }
            }
        }

        if (Object.keys(ratingList).length == 0) return interaction.reply(`You have never rated a song before!`);
        
        ratingList = Object.entries(ratingList).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));

        let pagedRatingList = _.chunk(ratingList, 10);
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

        for (let i = 0; i < pagedRatingList.length; i++) {

            for (let j = 0; j < pagedRatingList[i].length; j++) {
                pagedRatingList[i][j] = `• ${pagedRatingList[i][j][0]}: \`${pagedRatingList[i][j][1]}\``;
            }

            pagedRatingList[i] = pagedRatingList[i].join('\n');
        }  

        const ratingListEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(taggedUser.avatarURL({ extension: "png" }))
            .setAuthor({ name: `All ratings by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ extension: "png" }) })
            .setDescription(pagedRatingList[page_num]);
            if (pagedRatingList.length > 1) {
                ratingListEmbed.setFooter({ text: `Page 1 / ${pagedRatingList.length} • ${ratingCount} ratings given` });
                interaction.editReply({ content: null, embeds: [ratingListEmbed], components: [row] });
            } else {
                ratingListEmbed.setFooter({ text: `${ratingCount} ratings given` });
                interaction.editReply({ content: null, embeds: [ratingListEmbed], components: [] });
            }
        
        if (pagedRatingList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedRatingList.length - 1);
                ratingListEmbed.setDescription(pagedRatingList[page_num]);
                ratingListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedRatingList.length} • ${ratingCount} ratings given` });
                i.update({ embeds: [ratingListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ content: null, embeds: [ratingListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};