const { parse_spotify, handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

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

            for (let i = 0; i < memberIDList.length; i++) {
                let member = await interaction.guild.members.fetch(memberIDList[i]);
                if (member.presence == null) continue;
                member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        let sp_data = parse_spotify(activity);
                        let title = sp_data[1];
                        let displayArtists = sp_data[2][0];
                        displayList.push(`<@${member.user.id}>: \`${displayArtists.split('; ').join(' & ')} - ${title}\``);
                    }
                });
            }

            interaction.editReply(`${displayList.join('\n')}`);
        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
	},
};
