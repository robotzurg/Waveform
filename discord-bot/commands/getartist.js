const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, get_args, average, parse_spotify } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getartist')
        .setDescription('Get all the songs from an artist and display them in an embed message.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist.')
                .setRequired(true)),

    admin: false,
	execute(interaction) {

        let args = [];
        let spotifyCheck;
        args = get_args(interaction, args);

        //Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[0] = args[0].trim();
        
        // Spotify Check
        if (args[0].toLowerCase() === 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    let sp_data = parse_spotify(activity);
                    
                    if (args[0].toLowerCase() === 's') args[0] = sp_data[0][0];
                    spotifyCheck = true;
                }
            });
        }

        if (spotifyCheck === false && (args[0].toLowerCase() === 's')) {
            return interaction.editReply('Spotify status not detected, please type in the artist name manually or fix your status!');
        }

        const artistObj = db.reviewDB.get(args[0]);
        if (artistObj === undefined) return interaction.editReply('Artist not found.');
        const artistImage = artistObj.Image;
        let songArray = Object.keys(artistObj);
        songArray = songArray.filter(item => item !== 'Image');
        console.log(songArray);
        let reviewNum;
        const singleArray = [];
        const remixArray = [];

        let rankNumArray = [];
        let starNum = 0;
        let fullStarNum = 0;

		const artistEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${args[0]}'s reviewed tracks`);
            if (artistImage != false && artistImage != undefined) {
                artistEmbed.setThumbnail(artistImage);
            }

            for (let i = 0; i < songArray.length; i++) {
                if (songArray[i].includes('EP') || songArray[i].includes('LP')) continue;
                starNum = 0;
                const songObj = db.reviewDB.get(args[0], `["${songArray[i]}"]`);
                reviewNum = parseInt(db.reviewDB.get(args[0], `["${songArray[i]}"].review_num`));
                let reviews = Object.keys(songObj);

                reviews = reviews.filter(e => e !== 'remixers');
                reviews = reviews.filter(e => e !== 'ep');
                reviews = reviews.filter(e => e !== 'collab');
                reviews = reviews.filter(e => e !== 'art');
                reviews = reviews.filter(e => e !== 'vocals');
                reviews = reviews.filter(e => e !== 'hof_id');
                reviews = reviews.filter(e => e !== 'review_num');
                
                for (let ii = 0; ii < reviews.length; ii++) {
                    let rating;
                    rating = db.reviewDB.get(args[0], `["${songArray[i]}"].["${reviews[ii]}"].rating`);
                    rankNumArray.push(parseFloat(rating));
                    if (db.reviewDB.get(args[0], `["${songArray[i]}"].["${reviews[ii]}"].starred`) === true) { 
                        starNum++; 
                        fullStarNum++;
                    }
                }

                let songDetails;
                let remixerKeys = db.reviewDB.get(args[0], `["${songArray[i]}"].remixers`);

                console.log(remixerKeys);
                
                if (remixerKeys.length > 0) {
                    songDetails = [`\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\``, `\`${remixerKeys.length} remix${remixerKeys.length > 1 ? 'es' : ''}\``,
                    `${starNum != 0 ? `\`${starNum} stars\`` : ''}`];
                    songDetails = songDetails.join(' ');

                } else {
                    songDetails = `\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\`${starNum != 0 ? ` \`${starNum} ⭐\`` : ''}`;
                }

                if (!songArray[i].includes('Remix') /*&& !songArray[i].includes('EP') && !songArray[i].includes('LP') && !songArray[i].includes('/')*/) {
                    singleArray.push(`-${songArray[i]} ${songDetails}`);
                    singleArray[singleArray.length - 1] = singleArray[singleArray.length - 1].replace('*', '\\*');
                    console.log(singleArray);

                } else {
                    remixArray.push(`-${songArray[i]} ${songDetails}`);
                    remixArray[remixArray.length - 1] = remixArray[remixArray.length - 1].replace('*', '\\*');
                }
            }

            if (singleArray.length != 0) {
                artistEmbed.addField('Singles:', singleArray.join('\n'));
            }
            if (remixArray.length != 0) {
                artistEmbed.addField('Remixes:', remixArray.join('\n'));
            }


            if (rankNumArray != 0) {
                if (singleArray.length != 0 || remixArray.length != 0) {
                    if (fullStarNum != 0) {
                        artistEmbed.setDescription(`*The average rating of this artist is* ***${Math.round(average(rankNumArray) * 10) / 10}!***\n:star2: **This artist has ${fullStarNum} total stars!** :star2:`);
                    } else {
                        artistEmbed.setDescription(`*The average rating of this artist is* ***${Math.round(average(rankNumArray) * 10) / 10}!***`);
                    }
                } else {
                    artistEmbed.setDescription(`No reviewed songs. :(`);
                }
            } else {
                artistEmbed.setDescription(`No reviewed songs. :(`);
            }

        interaction.editReply({ embeds: [artistEmbed] });
	},
};
