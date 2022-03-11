const { parse_spotify, handle_error, get_user_reviews, average } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const Discord = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playing')
        .setDescription('See what everyone is playing on their spotify statuses.'),
	async execute(interaction, client) {
        try {
            const guild = await client.guilds.fetch(interaction.guild.id);
            const members = await guild.members.fetch();
            let memberIDList = members.map(v => v.user.id);
            let displayList = [];
            let avg;

            const playingEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(guild.iconURL({ format: 'png' }))
            .setTitle('Songs being played in Hotdog Water Review Corps');

            for (let i = 0; i < memberIDList.length; i++) {
                let member = await interaction.guild.members.fetch(memberIDList[i]);
                if (member.presence == null) continue;
                member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        avg = "N/A";
                        let sp_data = parse_spotify(activity);
                        let title = sp_data[1];
                        let displayArtists = sp_data[2][0];
                        let artistArray = displayArtists.split('; ');

                        if (db.reviewDB.has(artistArray[0])) {
                            let songObj = db.reviewDB.get(artistArray[0], `["${title}"]`);
            
                            if (songObj != undefined) {
                                let userArray = get_user_reviews(songObj);
                                const rankNumArray = [];
            
                                for (let j = 0; j < userArray.length; j++) {
                                    if (userArray[j] != 'ep') {
                                        let rating;
                                        rating = db.reviewDB.get(artistArray[0], `["${title}"].["${userArray[j]}"].rating`);
                                        rankNumArray.push(parseFloat(rating));
                                    }
                                }
            
                                avg = `${Math.round(average(rankNumArray) * 10) / 10}/10`;
                            } else {
                                avg = "N/A";
                            }
                        }

                        if (avg == undefined) { avg = "N/A"; }
                        displayList.push(`• [${member.displayName}](https://www.google.com): **${displayArtists.split('; ').join(' & ')} - ${title}**\n\`(Rating Avg: ${avg})\``);
                    }
                });
            }

            playingEmbed.setDescription(displayList.join('\n'));

            interaction.editReply({ embeds: [playingEmbed] });
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
