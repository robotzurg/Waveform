const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, get_user_reviews, find_most_duplicate } = require('../func');
const db = require('../db.js');
const Discord = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View general stats about the server\'s bot usage!'),
	async execute(interaction, client) {
        try {

            /* Info grabbed:
            
                # of Artists In Database
                # of Songs In Database
                # of EP/LPs In Database
                # of Reviews Made
                # of EP/LP Reviews Made
                # of Stars Given
                # of 10s Given
                # of 0s Given
                Most Reviewed Artist
                Average of all Ratings
                Most Given Rating

            */

            await interaction.editReply('Loading server stats, this make take a bit of time so please be patient!');

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
                songArray = songArray.filter(v => v != 'Image');

                for (let j = 0; j < songArray.length; j++) {
                    let userArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"]`);
                    if (userArray != null && userArray != undefined) {
                        userArray = get_user_reviews(userArray);
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

                    let otherArtists = [artistArray[i], db.reviewDB.get(artistArray[i], `["${songArray[j]}"].collab`), db.reviewDB.get(artistArray[i], `["${songArray[j]}"].vocals`)].flat(1);

                    let allArtists = otherArtists.map(v => {
                        if (v == undefined) {
                            return [];
                        }
                        return v;
                    });
                    allArtists = allArtists.flat(1);

                    for (let k = 0; k < userArray.length; k++) {
                        let userData = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].["${userArray[k]}"]`);
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

            const statsEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(guild.iconURL({ format: 'png' }))
            .setTitle('General Waveform Stats for this server')
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

            interaction.editReply({ content: ' ', sembeds: [statsEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};