const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdata')
        .setDescription('Add some data to an EP/LP review')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('data_type')
                .setDescription('The type of data to add the EP/LP review')
                .setRequired(true)
                .addChoices([
					[
						'overall_rating',
						'overall_rating',
					], [
						'overall_review',
						'overall_review',
					],
				]))
        .addStringOption(option => 
            option.setName('data')
                .setDescription('The data to insert (a number if rating, text if review)')
                .setRequired(true)),


	admin: false,
	async execute(interaction) {
        let artistArray = capitalize(interaction.options.getString('artists')).split(' & ');
        let ep_name = capitalize(interaction.options.getString('ep_name'));
        let data_type = interaction.options.getString('data_type');
        let data = interaction.options.getString('data');

        // Quick checks to see if we've got stuff in the database for this
        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`Artist \`${artistArray[i]}\` is not in the database.`);
            if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) return interaction.editReply(`\`${ep_name}\` is not in ${artistArray[i]}'s database.`);
            if (db.reviewDB.get(artistArray[i], `["${ep_name}"].["${interaction.user.id}"]`) === undefined) return interaction.editReply(`You don't have a review for ${ep_name} in the database.`);
        }

        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

        await channelsearch.messages.fetch(db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].msg_id`)).then(msg => {
            console.log(msg);
            let msgEmbed = msg.embeds[0];

            if (data_type === 'overall_rating') {
                msgEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${data}/10)`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], parseFloat(data), `["${ep_name}"].["${interaction.user.id}"].overall_rating`);
                }
            } else if (data_type === 'overall_review') {
                msgEmbed.setDescription(`*${data}*`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], data, `["${ep_name}"].["${interaction.user.id}"].overall_review`);
                }
            }

            msg.edit({ embeds: [msgEmbed] });
        });

        interaction.editReply(`Updated your review of ${ep_name} to house the new data. Check your review in #reviews!`);
    },
};