const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, average, get_user_reviews } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getep')
        .setDescription('Get all the songs from a specific EP and display them in an embed message.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP.')
                .setRequired(true)),
    admin: false,
	execute(interaction) {

        let origArtistArray = capitalize(interaction.options.getString('artists')).split(' & ');
        let epName = capitalize(interaction.options.getString('ep_name'));

        let artistArray = origArtistArray;

        const artistObj = db.reviewDB.get(artistArray[0]);
        if (artistObj === undefined) {
            return interaction.editReply('No artist found.');
        }

        const songArray = db.reviewDB.get(artistArray[0], `["${epName}"].songs`);
        if (songArray === undefined) {
            return interaction.editReply('No EP found.');
        }

        let epThumbnail = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
        if (epThumbnail === undefined || epThumbnail === false) {
            epThumbnail = interaction.user.avatarURL({ format: "png", dynamic: false });
        }

        let rankNumArray = [];
        let epRankArray = [];
        let songRankArray = [];
        let rating;

		const epEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${origArtistArray} - ${epName} tracks`);

            let reviewNum = Object.keys(db.reviewDB.get(artistArray[0], `["${epName}"]`));
            reviewNum = reviewNum.filter(e => e !== 'art');
            reviewNum = reviewNum.filter(e => e !== 'songs');
            reviewNum = reviewNum.filter(e => e !== 'collab');
            let userArray = reviewNum.slice(0);

            for (let i = 0; i < reviewNum.length; i++) {
                let userObj = db.reviewDB.get(artistArray[0], `["${epName}"].["${reviewNum[i]}"]`);
                userArray[i] = `<@${reviewNum[i]}>${(userObj.rating != false) ? ` \`${userObj.rating}/10\`` : ``}`;
                rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${reviewNum[i]}"].rating`);
                if (rating != false && rating != undefined && !isNaN(rating)) {
                   epRankArray.push(parseFloat(rating));
                }
            }
            
            let epnum = 0;
            for (let i = 0; i < songArray.length; i++) {

                let songArtist = artistArray[0];

                let songObj = db.reviewDB.get(songArtist, `["${songArray[i]}"]`);
                epEmbed.setThumbnail(epThumbnail);

                epnum++;

                reviewNum = get_user_reviews(songObj);
                rankNumArray = [];
                let star_num = 0;

                for (let ii = 0; ii < reviewNum.length; ii++) {
                    rating = db.reviewDB.get(songArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].rating`);
                    if (db.reviewDB.get(songArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].starred`) === true) {
                        star_num++;
                    }
                    rankNumArray.push(parseFloat(rating));
                }

                reviewNum = reviewNum.length;

                epEmbed.addField(`${epnum}. ${songArray[i]} (Avg: ${Math.round(average(rankNumArray) * 10) / 10})`, `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}`);
                songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
            }

            if (epRankArray.length != 0) {
                epEmbed.setDescription(`*The average overall user rating of this EP is* ***${Math.round(average(epRankArray) * 10) / 10}!***\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                `\n${userArray.join('\n')}`);
            } else {
                epEmbed.setDescription(`*This EP has no overall user ratings.*\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***` +
                `\n${userArray.join('\n')}`);
            }

        interaction.editReply({ embeds: [epEmbed] });
	},
};