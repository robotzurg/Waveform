const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, average, parse_spotify, get_user_reviews, sort, removeItemOnce } = require('../func.js');
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

        let spotifyCheck;
        let artist = capitalize(interaction.options.getString('artist'));
        
        // Spotify Check
        if (artist.toLowerCase() === 's') {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                    let sp_data = parse_spotify(activity);
                    if (artist.toLowerCase() === 's') artist = sp_data[0][0];
                    spotifyCheck = true;
                }
            });
        }

        if (spotifyCheck === false && (artist.toLowerCase() === 's')) {
            return interaction.editReply('Spotify status not detected, please type in the artist name manually or fix your status!');
        }

        const artistObj = db.reviewDB.get(artist);
        if (artistObj == undefined) return interaction.editReply('Artist not found.');
        const artistImage = artistObj.Image;
        let songArray = Object.keys(artistObj);
        songArray = songArray.filter(item => item !== 'Image');
        let epKeyArray = songArray.filter(item => item.includes('LP') || item.includes('EP'));
        songArray = songArray.filter(item => !item.includes('LP') && !item.includes('EP'));
        let reviewNum;
        let singleArray = [];
        let remixArray = [];
        let epArray = [];

        let rankNumArray = [];
        let starNum = 0; // Total number of individual song stars for each song
        let fullStarNum = 0; // Total number of stars
        let star_check = [];

		const artistEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artist}'s reviewed tracks`);
            if (artistImage != false && artistImage != undefined) {
                artistEmbed.setThumbnail(artistImage);
            }

            // Handle EP/LP songs
            for (let i = 0; i < epKeyArray.length; i++) {
                let epCollabArray = db.reviewDB.get(artist, `["${epKeyArray[i]}"].collab`);
                let epStarNum = 0;
                let epReviewNum = Object.keys(db.reviewDB.get(artist, `["${epKeyArray[i]}"]`));

                epReviewNum = epReviewNum.filter(x => x != 'art');
                epReviewNum = epReviewNum.filter(x => x != 'collab');
                epReviewNum = epReviewNum.filter(x => x != 'songs');

                console.log(epReviewNum);

                for (let s = 0; s < epReviewNum; s++) {
                    if (db.reviewDB.get(artist, `["${epKeyArray[i]}"].["${epReviewNum[s]}"].starred` == true)) epStarNum += 1;
                }

                epReviewNum = epReviewNum.length;

                let epDetails = `\`${epReviewNum} reviews\`${epStarNum > 0 ? ` \`${epStarNum} ⭐\`` : ``}`;

                let epData = [`**${epKeyArray[i]}` + 
                `${(epCollabArray.length != 0) ? ` (with ${epCollabArray.join(' & ')})` : ``} ${epDetails}**`];
                let epSongs = db.reviewDB.get(artist, `["${epKeyArray[i]}"].songs`);

                for (let ii = 0; ii < epSongs.length; ii++) {
                    starNum = 0;
                    const songObj = db.reviewDB.get(artist, `["${epSongs[ii]}"]`);
                    reviewNum = parseInt(db.reviewDB.get(artist, `["${epSongs[ii]}"].review_num`));
                    let reviews = get_user_reviews(songObj);
                    
                    for (let x = 0; x < reviews.length; x++) {
                        let rating = db.reviewDB.get(artist, `["${epSongs[ii]}"].["${reviews[x]}"].rating`);
                        let starred = db.reviewDB.get(artist, `["${epSongs[ii]}"].[${reviews[x]}].starred`);
                        rankNumArray.push(parseFloat(rating));
                        if (starred == true) { 
                            starNum++; 
                            fullStarNum++;
                            star_check.push(epSongs[ii]);
                        }
                    }

                    let songDetails;
                    let remixerKeys = db.reviewDB.get(artist, `["${epSongs[ii]}"].remixers`);
                    let collabArray = db.reviewDB.get(artist, `["${epSongs[ii]}"].collab`); // This also doubles as remixer original artists
                    let vocalistArray = db.reviewDB.get(artist, `["${epSongs[ii]}"].vocals`);

                    if (remixerKeys.length > 0) {
                        songDetails = [`\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\``, `\`${remixerKeys.length} remix${remixerKeys.length > 1 ? 'es' : ''}\``,
                        `${starNum != 0 ? `\`${starNum} stars\`` : ''}`];
                        songDetails = songDetails.join(' ');
                    } else {
                        songDetails = `\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\`${starNum != 0 ? ` \`${starNum} ⭐\`` : ''}`;
                    }

                    epData.push([`-${epSongs[ii]}` + 
                    `${(collabArray.length != 0) ? ` (with ${collabArray.join(' & ')})` : ``}` + 
                    `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` + 
                    ` ${songDetails}`]);

                    removeItemOnce(songArray, epSongs[ii]);
                }

                epArray.push(epData.join('\n'));
            }

            for (let i = 0; i < songArray.length; i++) {

                starNum = 0;
                const songObj = db.reviewDB.get(artist, `["${songArray[i]}"]`);
                reviewNum = parseInt(db.reviewDB.get(artist, `["${songArray[i]}"].review_num`));
                let reviews = get_user_reviews(songObj);
                
                for (let ii = 0; ii < reviews.length; ii++) {
                    let rating = db.reviewDB.get(artist, `["${songArray[i]}"].["${reviews[ii]}"].rating`);
                    let starred = db.reviewDB.get(artist, `["${songArray[i]}"].[${reviews[ii]}].starred`);
                    rankNumArray.push(parseFloat(rating));
                    if (starred == true) { 
                        starNum++; 
                        fullStarNum++;
                        star_check.push(songArray[i]);
                    }
                }

                let songDetails;
                let remixerKeys = db.reviewDB.get(artist, `["${songArray[i]}"].remixers`);
                let collabArray = db.reviewDB.get(artist, `["${songArray[i]}"].collab`); // This also doubles as remixer original artists
                let vocalistArray = db.reviewDB.get(artist, `["${songArray[i]}"].vocals`);

                if (remixerKeys.length > 0) {
                    songDetails = [`\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\``, `\`${remixerKeys.length} remix${remixerKeys.length > 1 ? 'es' : ''}\``,
                    `${starNum != 0 ? `\`${starNum} stars\`` : ''}`];
                    songDetails = songDetails.join(' ');
                } else {
                    songDetails = `\`${reviewNum} review${reviewNum > 1 || reviewNum === 0 ? 's' : ''}\`${starNum != 0 ? ` \`${starNum} ⭐\`` : ''}`;
                }

                if (songArray[i].includes('Remix')) {
                    remixArray.push([(star_check.includes(songArray[i])) ? 99999 : reviewNum, `-${collabArray.join(' & ')} - ${songArray[i]} ${songDetails}`]);
                    // Escape character the stars so that they don't italicize the texts
                    remixArray[remixArray.length - 1][1] = remixArray[remixArray.length - 1][1].replace('*', '\\*');
                } else { // Singles
                    singleArray.push([(star_check.includes(songArray[i])) ? 99999 : reviewNum, `-${songArray[i]}` + 
                    `${(collabArray.length != 0) ? ` (with ${collabArray.join(' & ')})` : ``}` + 
                    `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` + 
                    ` ${songDetails}`]);
                    // Escape character the stars so that they don't italicize the text
                    singleArray[singleArray.length - 1][1] = singleArray[singleArray.length - 1][1].replace('*', '\\*');
                }
            }

            if (singleArray.length != 0) {
                singleArray = sort(singleArray);
                artistEmbed.addField('Singles:', singleArray.join('\n'));
            }

            if (epArray.length != 0) {
                artistEmbed.addField('EPs/LPs:', epArray.join('\n'));
            }

            if (remixArray.length != 0) {
                remixArray = sort(remixArray);
                artistEmbed.addField('Remixes:', remixArray.join('\n'));
            }


            if (rankNumArray != 0) { // If we pull songs but we don't have any reviews in any of the artists songs
                if (singleArray.length != 0 || remixArray.length != 0) { // If there is no songs in the artists database
                    if (fullStarNum != 0) { // If the artist has stars on any of their songs
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
