/* eslint-disable no-unreachable */
const { handle_error, get_user_reviews, find_most_duplicate } = require('../func');
const db = require('../db.js');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Get general info about the bot as a whole!')
        .setDMPermission(false),
    help_desc: `TBD`,
	async execute(interaction, client) {
        try {
            return await interaction.reply('This command is not yet ready.');
            let artistCount = 0;
            let songCount = 0;
            let epCount = 0;
            let reviewCount = 0;
            let epReviewCount = 0;
            let starCount = 0;
            let tenCount = 0;
            let zeroCount = 0;
            let mostArtist = 0;
            let ratingAvg = 0;
            let mostGivenRating = 0;
            let artistList = [];
            let songSkip = [];
            let ratingList = [];

            let artistArray = db.reviewDB.keyArray();

            for (let i = 0; i < artistArray.length; i++) {
                artistCount += 1;
                let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
                songArray = songArray.filter(v => v != 'pfp_image');

                for (let j = 0; j < songArray.length; j++) {

                    let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                    let userArray;
                    if (songObj != null && songObj != undefined) {
                        userArray = get_user_reviews(songObj);
                    } else {
                        userArray = [];
                    }

                    if (userArray.length != 0) artistList.push(artistArray[i]);
                    if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                    if (!songArray[j].includes(' EP') && !songArray[j].includes(' LP')) {
                        songCount += 1;
                    } else {
                        epCount += 1;
                    }

                    let otherArtists = [artistArray[i], songObj.collab].flat(1);

                    let allArtists = otherArtists.map(v => {
                        if (v == undefined) {
                            return [];
                        }
                        return v;
                    });
                    allArtists = allArtists.flat(1);

                    for (let k = 0; k < userArray.length; k++) {
                        let userData = songObj[userArray[k]];
                        ratingList.push(parseFloat(userData.rating));
                        if (songArray[j].includes(' EP') || songArray[j].includes(' LP')) {
                            epReviewCount += 1;
                        } else {
                            reviewCount += 1;
                        }

                        if (userData.starred == true) {
                            starCount += 1;
                        }

                        if (parseFloat(userData.rating) == 10) tenCount += 1;
                        if (parseFloat(userData.rating) == 0) zeroCount += 1;
                    }

                    for (let v = 0; v < allArtists.length; v++) {
                        if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                            songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                        }
                    }
                }
            }

            mostArtist = find_most_duplicate(artistList);
            ratingList = ratingList.filter(v => !Number.isNaN(v));
            mostGivenRating = find_most_duplicate(ratingList);
            ratingAvg = _.mean(ratingList).toFixed(2);

            const guild = await client.guilds.fetch(interaction.guild.id);

            const statsEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(guild.iconURL({ extension: 'png' }))
            .setTitle('Bot Information')
            .addFields(
                { name: 'Number of Artists', value: `${artistCount}`, inline: true },
                { name: 'Number of Songs', value: `${songCount}`, inline: true },
                { name: 'Number of EP/LPs', value: `${epCount}`, inline: true },
                { name: 'Number of Reviews', value: `${reviewCount}`, inline: true },
                { name: 'Number of EP/LP Reviews', value: `${epReviewCount}`, inline: true },
                { name: 'Number of Stars', value: `${starCount}`, inline: true },
                { name: 'Number of 10s Given', value: `${tenCount}`, inline: true },
                { name: 'Number of 0s Given', value: `${zeroCount}`, inline: true },
                { name: 'Most Reviewed Artist', value: `${mostArtist[0][0]} \`(${mostArtist[0][1]} reviews)\`` },
                { name: 'Average Of All Ratings', value: `${ratingAvg}/10` },
                { name: 'Most Given Rating', value: `${mostGivenRating[0][0]} \`(${mostGivenRating[0][1]} times)\`` },
            );

            interaction.editReply({ content: null, embeds: [statsEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};