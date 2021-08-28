const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, get_args } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getep')
        .setDescription('Get all the songs from a specific EP and display them in an embed message.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP.')
                .setRequired(true)),
    admin: false,
	execute(interaction) {

        let args = [];
        args = get_args(interaction, args);

        for (let i = 0; i < args.length; i++) {
            args[i] = capitalize(args[i]);
            args[i] = args[i].trim();
        }

        let argArtistArray = args[0];
        let argEPName = args[1];

        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        let artistArray = argArtistArray.split(' & ');

        const artistObj = db.reviewDB.get(artistArray[0]);
        if (artistObj === undefined) {
            return interaction.editReply('No artist found.');
        }

        const songArray = db.reviewDB.get(artistArray[0], `["${argEPName}"].songs`);
        if (songArray === undefined) {
            return interaction.editReply('No EP found.');
        }

        let epThumbnail = db.reviewDB.get(artistArray[0], `["${argEPName}"].art`);
        if (epThumbnail === undefined || epThumbnail === false) {
            epThumbnail = interaction.user.avatarURL({ format: "png", dynamic: false });
        }

        let rankNumArray = [];
        let EPrankArray = [];
        let songRankArray = [];
        let rating;

		const epEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${argArtistArray} - ${argEPName} tracks`);

            let reviewNum = Object.keys(db.reviewDB.get(artistArray[0], `["${argEPName}"]`));
            reviewNum = reviewNum.filter(e => e !== 'art');
            reviewNum = reviewNum.filter(e => e !== 'songs');
            reviewNum = reviewNum.filter(e => e !== 'collab');

            for (let i = 0; i < reviewNum.length; i++) {
                console.log(argEPName);
                console.log(reviewNum[i]);
                rating = db.reviewDB.get(artistArray[0], `["${argEPName}"].["${reviewNum[i]}"].rating`);
                if (rating != false && rating != undefined && !isNaN(rating)) {
                   EPrankArray.push(parseFloat(rating));
                }
            }
            
            let epnum = 0;
            for (let i = 0; i < songArray.length; i++) {

                let rmxArtist = false;
                let songArtist = artistArray[0];

                if (songArray[i].toLowerCase().includes('remix')) {
                    rmxArtist = songArray[i].substring(0, songArray[i].length - 7).split(' (R')[1];
                    songArtist = rmxArtist;
                }

                let songObj = db.reviewDB.get(songArtist, `["${songArray[i]}"]`);
                epEmbed.setThumbnail(epThumbnail);

                epnum++;

                reviewNum = Object.keys(songObj);
                rankNumArray = [];
                let star_num = 0;

                reviewNum = reviewNum.filter(e => e !== 'remixers');
                reviewNum = reviewNum.filter(e => e !== 'ep');
                reviewNum = reviewNum.filter(e => e !== 'collab');
                reviewNum = reviewNum.filter(e => e !== 'art');
                reviewNum = reviewNum.filter(e => e !== 'vocals');
                reviewNum = reviewNum.filter(e => e !== 'review_num');
                reviewNum = reviewNum.filter(e => e !== 'hof_id');

                for (let ii = 0; ii < reviewNum.length; ii++) {
                    rating = db.reviewDB.get(songArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].rating`);
                    if (db.reviewDB.get(songArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].starred`) === true) {
                        star_num++;
                    }
                    console.log(rating);
                    rankNumArray.push(parseFloat(rating));
                }

                reviewNum = reviewNum.length;

                epEmbed.addField(`${epnum}. ${songArray[i]} (Avg: ${Math.round(average(rankNumArray) * 10) / 10})`, `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}`);
                songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
            }

            if (EPrankArray.length != 0) {
                epEmbed.setDescription(`*The average overall user rating of this EP is* ***${Math.round(average(EPrankArray) * 10) / 10}!***\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***`);
            } else {
                epEmbed.setDescription(`*This EP has no overall user ratings.*\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***`);
            }

        interaction.editReply({ embeds: [epEmbed] });
	},
};