const Discord = require('discord.js');
const db = require('../db.js');
const { parse_spotify, get_user_reviews, handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Display your currently playing song on Spotify!'),
	execute(interaction) {
        try {
            let sent = false;
            // Function to grab average of all ratings later
            let average = (array) => array.reduce((a, b) => a + b) / array.length;
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                    let sp_data = parse_spotify(activity);
                    let url = `https://open.spotify.com/track/${activity.syncId}`;
                    let yourReview = false;
                    let artistArray = sp_data[0];
                    let title = sp_data[1];
                    let displayArtists = sp_data[2];

                    const npEmbed = new Discord.MessageEmbed()
                    .setColor(`${interaction.member.displayHexColor}`)
                    .setTitle(`${displayArtists.join(' & ')} - ${title}`)
                    .setAuthor({ name: `${interaction.member.displayName}'s current song`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

                    if (db.reviewDB.has(artistArray[0])) {

                        let songObj = db.reviewDB.get(artistArray[0], `["${title}"]`);

                        if (songObj != undefined) {

                            let userArray = get_user_reviews(songObj);

                            const rankNumArray = [];
                            let starNum = 0;
                            let yourStar = '';

                            for (let i = 0; i < userArray.length; i++) {

                                if (userArray[i] == `${interaction.user.id}`) {
                                    yourReview = db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].rating`);
                                }

                                if (userArray[i] != 'ep') {
                                    let rating;
                                    rating = db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].rating`);

                                    if (db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[i]}"].starred`) == true) {
                                        starNum++;
                                        if (userArray[i] == `${interaction.user.id}`) {
                                            yourStar = '⭐'; //Added to the end of your rating tab
                                        }
                                    }

                                    rankNumArray.push(parseFloat(rating));
                                    userArray[i] = [rating, `${userArray[i]} \`${rating}\``];
                                }
                            }

                            if (rankNumArray.length != 0) { 
                                npEmbed.setDescription(`Reviews: \`${userArray.length} reviews\`\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}${yourReview != false ? `\nYour Rating: \`${yourReview}/10${yourStar}\`` : ''}\n<:spotify:961509676053323806> [Spotify](${url})`);
                            } else {
                                npEmbed.setDescription(`This song has not been reviewed in the database.\n<:spotify:961509676053323806> [Spotify](${url})`);
                            }

                            if (songObj.ep != undefined && songObj.ep != false) {
                                if (db.reviewDB.get(artistArray[0], `["${songObj.ep}"].art`) != false) {
                                    npEmbed.setFooter(`from ${songObj.ep}`, db.reviewDB.get(artistArray[0], `["${db.reviewDB.get(artistArray[0], `["${title}"].ep`)}"].art`));
                                } else {
                                    npEmbed.setFooter(`from ${songObj.ep}`);
                                }
                            }
                        } else {
                            npEmbed.setDescription(`This song has not been reviewed in the database.\n<:spotify:961509676053323806> [Spotify](${url})`);
                        }

                    } else {
                        npEmbed.setDescription(`This song has not been reviewed in the database.\n<:spotify:961509676053323806> [Spotify](${url})`);
                    }

                    if (activity.assets.largeImage != undefined && activity.assets.largeImage != null) {
                        npEmbed.setThumbnail(`https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`);
                    }
                    
                    interaction.editReply({ embeds: [npEmbed] });
                    sent = true;
                }
            });
            
            if (sent == false) return interaction.editReply('You aren\'t playing a song on Spotify.');
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
