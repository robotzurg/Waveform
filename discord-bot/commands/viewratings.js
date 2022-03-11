const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
const { get_user_reviews, handle_error } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('viewratings')
        .setDescription('View a specified list of ratings based on a number you put in!')
        .addStringOption(option => 
            option.setName('rating')
                .setDescription('What rating you want to see a list of.')
                .setAutocomplete(false)
                .setRequired(true))
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose list you want to see. Defaults to yourself.')
                .setRequired(false)),
	async execute(interaction) {

        try {

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
        let ratingList = [];
        let ratingCheck = parseFloat(interaction.options.getString('rating'));

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            songArray = songArray.filter(v => v != 'Image');

            for (let j = 0; j < songArray.length; j++) {
                let userArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"]`);
                userArray = get_user_reviews(userArray);
                userArray = userArray.filter(v => v == taggedUser.id);
                if (userArray.length != 0) artistCount.push(artistArray[i]);
                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                let collabArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].collab`);
                let vocalistArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].vocals`);
                if (collabArray == undefined) collabArray = [];
                if (vocalistArray == undefined) vocalistArray = [];

                collabArray = collabArray.filter(v => !vocalistArray.includes(v));

                let otherArtists = [artistArray[i], collabArray, vocalistArray].flat(1);

                let allArtists = otherArtists.map(v => {
                    if (v === undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);

                for (let k = 0; k < userArray.length; k++) {
                    let userData = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].["${userArray[k]}"]`);
                    if (ratingCheck == parseFloat(userData.rating)) {
                        let primArtist = artistArray[i];
                        if (vocalistArray.includes(artistArray[i])) primArtist = collabArray.shift();
                        if (songArray[j].includes(' Remix)')) primArtist = collabArray.shift();

                        ratingList.push(`**[${primArtist}${(collabArray.length != 0) ? ` & ${collabArray.join(' & ')}` : ``} - ` + 
                       `${songArray[j]}](https://www.google.com)**${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);
                    }
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                    }
                }
            }
        }

        ratingList = ratingList.filter(v => !v.includes(' EP'));
        ratingList = ratingList.filter(v => !v.includes(' LP'));

        if (ratingList.length == 0) return interaction.editReply(`You have never rated a song ${ratingCheck}/10.`);

        ratingList.sort();

        let pagedRatingList = _.chunk(ratingList, 10);
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

        for (let i = 0; i < pagedRatingList.length; i++) {

            for (let j = 0; j < pagedRatingList[i].length; j++) {
                pagedRatingList[i][j] = `• ` + pagedRatingList[i][j];
            }

            pagedRatingList[i] = pagedRatingList[i].join('\n');
        }  

        const ratingListEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(taggedUser.avatarURL({ format: "png" }))
            .setAuthor({ name: `List of Songs Rated ${ratingCheck}/10 by ${taggedMember.displayName}`, iconURL: taggedUser.avatarURL({ format: "png" }) })
            .setDescription(pagedRatingList[page_num]);
            if (pagedRatingList.length > 1) {
                ratingListEmbed.setFooter({ text: `Page 1 / ${pagedRatingList.length} • ${ratingList.length} songs rated ${ratingCheck}/10` });
                interaction.editReply({ embeds: [ratingListEmbed], components: [row] });
            } else {
                ratingListEmbed.setFooter({ text: `${ratingList.length} songs rated ${ratingCheck}/10` });
                interaction.editReply({ embeds: [ratingListEmbed], components: [] });
            }
        
        if (pagedRatingList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedRatingList.length - 1);
                ratingListEmbed.setDescription(pagedRatingList[page_num]);
                ratingListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedRatingList.length} • ${ratingList.length} songs rated ${ratingCheck}/10` });
                i.update({ embeds: [ratingListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [ratingListEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};