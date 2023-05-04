const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hall-of-fame')
        .setDescription('View the server hall of fame!')
        .setDMPermission(false),
    help_desc: 'TBD',
	async execute(interaction) {
        await interaction.deferReply();

        await interaction.editReply(`Loading hall of fame list, please wait just a moment, this could take a while!`);

        let hofList = [];
        let starCutoff = db.server_settings.get(interaction.guild.id, 'star_cutoff');
        let songSkip = [];
        let starCount = 0;
        let userStarList = [];
        let ratingAvgList = [];
        let addedToList = false;

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            songArray = songArray.filter(v => v != 'Image');

            for (let j = 0; j < songArray.length; j++) {
                // Reset all song stats for the hof back to normal state
                starCount = 0;
                userStarList = [];
                addedToList = false;
                ratingAvgList = [];

                // Basic data grabbing
                let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                let userArray;
                if (songObj != null && songObj != undefined) {
                    userArray = get_user_reviews(songObj);
                } else {
                    userArray = [];
                }

                if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                let mainArtistArray = [artistArray[i], db.reviewDB.get(artistArray[i])[songArray[j]].collab].flat(1);
                let vocalistArray = db.reviewDB.get(artistArray[i])[songArray[j]].vocals;
                if (vocalistArray == undefined) vocalistArray = [];

                let allArtists = mainArtistArray.map(v => {
                    if (v == undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);
                mainArtistArray = mainArtistArray.filter(v => !vocalistArray.includes(v));

                for (let user of userArray) {
                    if (songObj[user].rating != false) ratingAvgList.push(parseFloat(songObj[user].rating));
                    if (songObj[user].starred == true) {
                        starCount += 1;
                        userStarList.push({ id: user, rating: songObj[user].rating });
                    }

                    if (starCount >= starCutoff && addedToList == false) {
                        hofList.push({ 
                            name: `${mainArtistArray.join(' & ')} - ${songArray[j]}` + `${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`,
                            art: songObj.art,
                            rating_avg: 10, 
                            star_count: 3,
                            user_stars: [],
                        });
                        addedToList = true;
                    }
                }

                if (addedToList == true) {
                    hofList[hofList.length - 1].star_count = starCount;
                    hofList[hofList.length - 1].user_stars = userStarList;
                    hofList[hofList.length - 1].rating_avg = Math.round(_.mean(ratingAvgList) * 10) / 10;
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                        songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                    }
                }
            }
        }

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

        let hofCommandEmbed = new EmbedBuilder()
            .setColor(`#ffff00`)
            .setTitle(hofList[0].name)
            .setDescription(`This song currently has **${hofList[0].star_count}** stars 🌟\nAverage Rating: **${hofList[0].rating_avg}**`)
            .addFields({ name: 'Starred Reviews:', value: hofList[0].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
            .setImage(hofList[0].art)
            .setFooter({ text: `Page 1 / ${hofList.length}` });
        
        interaction.editReply({ content: null, embeds: [hofCommandEmbed], components:[row] });

        if (hofList.length > 1) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, hofList.length - 1);
                hofCommandEmbed = new EmbedBuilder()
                .setColor(`#ffff00`)
                .setTitle(hofList[page_num].name)
                .setDescription(`This song currently has **${hofList[page_num].star_count}** stars 🌟\nAverage Rating: **${hofList[page_num].rating_avg}**`)
                .addFields({ name: 'Starred Reviews:', value: hofList[page_num].user_stars.map(v => `🌟 <@${v.id}> \`${v.rating}/10\``).join('\n') })
                .setImage(hofList[page_num].art)
                .setFooter({ text: `Page ${page_num + 1} / ${hofList.length}` });

                i.update({ embeds: [hofCommandEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [hofCommandEmbed], components: [] });
            });
        }
    },
};
