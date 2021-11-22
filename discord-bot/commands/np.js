const Discord = require('discord.js');
const db = require('../db.js');
const { capitalize, parse_spotify } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Display your currently playing song on Spotify!'),
	execute(interaction) {
        let sent = false;
        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        interaction.member.presence.activities.forEach((activity) => {
            if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                let sp_data = parse_spotify(activity);
                let url = `https://open.spotify.com/track/${activity.syncId}`;
                let yourReview = false;
                let artistArray = sp_data[0];
                let title = sp_data[1];
                let displayArtists = sp_data[2];

                const exampleEmbed = new Discord.MessageEmbed()
                .setColor(`${interaction.member.displayHexColor}`)
                .setTitle(`${displayArtists} - ${title}`)
                .setAuthor(`${interaction.member.displayName}'s current song`, `${interaction.user.avatarURL({ format: "png", dynamic: false })}`);

                artistArray[0] = capitalize(artistArray[0]);

                if (db.reviewDB.has(artistArray[0])) {

                    title = capitalize(title);

                    if (db.reviewDB.get(artistArray[0], `["${title}"]`) != undefined) {

                        let userArray = Object.keys(db.reviewDB.get(artistArray[0], `["${title}"]`));
            
                        userArray = userArray.filter(e => e !== 'ep');
                        userArray = userArray.filter(e => e !== 'art');
                        userArray = userArray.filter(e => e !== 'remixers');
                        userArray = userArray.filter(e => e !== 'collab');
                        userArray = userArray.filter(e => e !== 'vocals');
                        userArray = userArray.filter(e => e !== 'hof_id');
                        userArray = userArray.filter(e => e !== 'review_num');
                        
                        const rankNumArray = [];
                        let starNum = 0;
                        let yourStar = '';

                            for (let i = 0; i < userArray.length; i++) {
                                
                                if (userArray[i] === `${interaction.user.id}`) {
                                    yourReview = db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].rating`);
                                    console.log(yourReview);
                                }
                                if (userArray[i] != 'ep') {
                                    let rating;
                                    rating = db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].rating`);

                                    if (db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].starred`) === true) {
                                        starNum++;
                                        console.log(userArray[i]);
                                        if (userArray[i] === `${interaction.user.id}`) {
                                            yourStar = '⭐'; //Added to the end of your rating tab
                                        }
                                    }

                                    rankNumArray.push(parseFloat(rating));
                                    userArray[i] = [rating, `${userArray[i]} \`${rating}\``];
                                }
                            }

                        exampleEmbed.setDescription(`Reviews: \`${userArray.length} reviews\`\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}${yourReview != false ? `\nYour Rating: \`${yourReview}/10${yourStar}\`` : ''}\n<:spotify:899365299814559784> [Spotify](${url})`);

                        if (db.reviewDB.get(artistArray[0], `["${title}"].ep`) != undefined && db.reviewDB.get(artistArray[0], `["${title}"].ep`) != false) {
                            exampleEmbed.setFooter(`from ${db.reviewDB.get(artistArray[0], `["${title}"].ep`)}`, db.reviewDB.get(artistArray[0], `["${db.reviewDB.get(artistArray[0], `["${title}"].ep`)}"].art`));
                        }
                    } else {
                        exampleEmbed.setDescription(`This song has not been reviewed in the database.\n<:spotify:899365299814559784> [Spotify](${url})`);
                    }

                } else {
                    if (!title.toLowerCase().includes('remix')) {
                        exampleEmbed.setDescription(`This artist has not been reviewed in the database.\n<:spotify:899365299814559784> [Spotify](${url})`);
                    }
                }

                if (activity.assets.largeImage != undefined && activity.assets.largeImage != null) {
                    exampleEmbed.setThumbnail(`https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`);
                }
                
                interaction.editReply({ embeds: [exampleEmbed] });
                sent = true;
            }
        });
        
        if (sent === false) return interaction.editReply('You aren\'t playing a song on Spotify.');
	},
};
