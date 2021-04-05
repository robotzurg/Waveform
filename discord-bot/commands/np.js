const Discord = require('discord.js');
const db = require('../db.js');

module.exports = {
	name: 'np',
	type: 'Fun',
	description: 'Display your currently playing song on Spotify!',
	execute(message) {
        let sent = false;
        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        message.author.presence.activities.forEach((activity) => {
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
                        artists[i] = artists[i].split(' ');
                        artists[i] = artists[i].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                        artists[i] = artists[i].join(' ');
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
                    activity.details = `${title[0]} [${rmxArtist} Remix]`;
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
                .setColor(`${message.member.displayHexColor}`)
                .setTitle(`${artists} - ${activity.details}`)
                .setAuthor(`${message.member.displayName}'s current song`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);

                artistArray[0] = artistArray[0].split(' ');
                artistArray[0] = artistArray[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
                artistArray[0] = artistArray[0].join(' ');

                if (rmxArtist != false) {
                    rmxArtist = rmxArtist.split(' ');
                    rmxArtist = rmxArtist.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    rmxArtist = rmxArtist.join(' ');

                    artistArray[0] = rmxArtist;
                }

                if (db.reviewDB.has(artistArray[0])) {

                    activity.details = activity.details.split(' ');
                    activity.details = activity.details.map(a => a.charAt(0).toUpperCase() + a.slice(1));
                    activity.details = activity.details.join(' ');

                    if (db.reviewDB.get(artistArray[0], `["${activity.details}"]`) != undefined) {

                        let userArray = Object.keys(db.reviewDB.get(artistArray[0], `["${activity.details}"]`));
            
                        userArray = userArray.filter(e => e !== 'EP');
                        userArray = userArray.filter(e => e !== 'Image');
                        userArray = userArray.filter(e => e !== 'Remixers');
                        userArray = userArray.filter(e => e !== 'Collab');
                        userArray = userArray.filter(e => e !== 'Vocals');
                        userArray = userArray.filter(e => e !== 'EPpos');
                        
                        const rankNumArray = [];
                        let starNum = 0;
                        let yourStar = '';

                            for (let i = 0; i < userArray.length; i++) {
                                
                                if (userArray[i] === `<@${message.author.id}>`) {
                                    yourReview = db.reviewDB.get(artistArray[0], `["${activity.details}"].["${userArray[i]}"].rate`);
                                }
                                if (userArray[i] != 'EP') {
                                    let rating;
                                    rating = db.reviewDB.get(artistArray[0], `["${activity.details}"].${userArray[i]}.rate`);

                                    if (db.reviewDB.get(artistArray[0], `["${activity.details}"].${userArray[i]}.starred`) === true) {
                                        starNum++;
                                        console.log(userArray[i]);
                                        if (userArray[i] === `<@${message.author.id}>`) {
                                            yourStar = '⭐'; //Added to the end of your rating tab
                                        }
                                    }

                                    rankNumArray.push(parseFloat(rating.slice(0, -3)));
                                    userArray[i] = [parseFloat(rating.slice(0, -3)), `${userArray[i]} \`${rating}\``];
                                }
                            }

                        exampleEmbed.setDescription(`Reviews: \`${userArray.length} reviews\`\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}${yourReview != false ? `\nYour Rating: \`${yourReview}${yourStar}\`` : ''}`);

                        if (db.reviewDB.get(artistArray[0], `["${activity.details}"].EP`) != undefined && db.reviewDB.get(artistArray[0], `["${activity.details}"].EP`) != false) {
                            exampleEmbed.setFooter(`from ${db.reviewDB.get(artistArray[0], `["${activity.details}"].EP`)}`, db.reviewDB.get(artistArray[0], `["${db.reviewDB.get(artistArray[0], `["${activity.details}"].EP`)}"].Image`));
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
                
                message.channel.send(exampleEmbed);
                sent = true;
            }
        });

        if (sent === false) return message.channel.send('You aren\'t playing a song on Spotify.');
	},
};