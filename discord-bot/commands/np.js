const Discord = require('discord.js');
const db = require('../db.js');
const { capitalize } = require('../func.js');

module.exports = {
	name: 'np',
	description: 'Display your currently playing song on Spotify!',
    options: [],
	execute(interaction) {
        let sent = false;
        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        interaction.member.presence.activities.forEach((activity) => {
            if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                let artists = activity.state;
                let artistArray = [activity.state];
                let rmxArtist = false;
                let yourReview = false;
                if (artists.includes(';')) {
                    artists = artists.split('; ');
                    if (activity.details.includes('feat.') || activity.details.includes('ft.') || activity.details.includes('remix')) {
                        artists.pop();
                    }
                    artistArray = artists;
                    artists = artists.join(' & ');
                }

                if (artists.includes(',')) {
                    artists = artists.split(', ');
                    for (let i = 0; i < artists.length; i++) {
                        artists[i] = capitalize(artists[i]);
                    }
                    artists = artists.join(' & ');
                }
                
                // Fix some formatting for a couple things
                if (activity.details.includes('- Extended Mix')) {
                    activity.details = activity.details.replace('- Extended Mix', `(Extended Mix)`);
                }

                if (activity.details.includes('Remix') && activity.details.includes('-')) {
                    let title = activity.details.split(' - ');
                    rmxArtist = title[1].slice(0, -6);
                    activity.details = `${title[0]} (${rmxArtist} Remix)`;
                }

                if (activity.details.includes('VIP') && activity.details.includes('-')) {
                    let title = activity.details.split(' - ');
                    activity.details = `${title[0]} VIP`;
                }

                if (activity.details.includes('(VIP)')) {
                    let title = activity.details.split(' (V');
                    activity.details = `${title[0]} VIP`;
                }

                const exampleEmbed = new Discord.MessageEmbed()
                .setColor(`${interaction.member.displayHexColor}`)
                .setTitle(`${artists} - ${activity.details}`)
                .setAuthor(`${interaction.member.displayName}'s current song`, `${interaction.user.avatarURL({ format: "png", dynamic: false })}`);

                artistArray[0] = capitalize(artistArray[0]);

                if (rmxArtist != false) {
                    rmxArtist = capitalize(rmxArtist);
                    artistArray[0] = rmxArtist;
                }

                if (db.reviewDB.has(artistArray[0])) {

                    activity.details = capitalize(activity.details);

                    if (db.reviewDB.get(artistArray[0], `["${activity.details}"]`) != undefined) {

                        let userArray = Object.keys(db.reviewDB.get(artistArray[0], `["${activity.details}"]`));
            
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
                                    yourReview = db.reviewDB.get(artistArray[0], `["${activity.details}"].["${userArray[i]}"].rating`);
                                    console.log(yourReview);
                                }
                                if (userArray[i] != 'ep') {
                                    let rating;
                                    rating = db.reviewDB.get(artistArray[0], `["${activity.details}"].["${userArray[i]}"].rating`);

                                    if (db.reviewDB.get(artistArray[0], `["${activity.details}"].["${userArray[i]}"].starred`) === true) {
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

                        exampleEmbed.setDescription(`Reviews: \`${userArray.length} reviews\`\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}${yourReview != false ? `\nYour Rating: \`${yourReview}/10${yourStar}\`` : ''}`);

                        if (db.reviewDB.get(artistArray[0], `["${activity.details}"].ep`) != undefined && db.reviewDB.get(artistArray[0], `["${activity.details}"].ep`) != false) {
                            exampleEmbed.setFooter(`from ${db.reviewDB.get(artistArray[0], `["${activity.details}"].ep`)}`, db.reviewDB.get(artistArray[0], `["${db.reviewDB.get(artistArray[0], `["${activity.details}"].ep`)}"].art`));
                        }
                    } else {
                        exampleEmbed.setDescription(`This song has not been reviewed in the database.`);
                    }

                } else {
                    if (!activity.details.toLowerCase().includes('remix')) {
                        exampleEmbed.setDescription(`This artist is not been reviewed in the database.`);
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