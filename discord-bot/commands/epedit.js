const db = require("../db.js");
const { capitalize } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epedit')
        .setDescription('Edit/add data to an EP/LP review')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ep_rating')
                .setDescription('The new rating of the EP/LP.')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('ep_review')
                .setDescription('The new written overall review of the EP/LP.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        let artistArray = capitalize(interaction.options.getString('artists')).split(' & ');
        let ep_name = capitalize(interaction.options.getString('ep_name'));
        let ep_rating = interaction.options.getString('ep_rating');
        let ep_review = interaction.options.getString('ep_review');

        if (ep_rating == null && ep_review == null) return interaction.editReply('You must either edit the ep overall rating, or ep overall review with this command!');

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

            if (ep_rating != null) {
                msgEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${ep_rating}/10)`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], parseFloat(ep_rating), `["${ep_name}"].["${interaction.user.id}"].rating`);
                }
            }
            
            if (ep_review != null) {
                if (ep_review.includes('\\n')) {
                    ep_review = ep_review.split('\\n').join('\n');
                }
                msgEmbed.setDescription(`*${ep_review}*`);
                for (let i = 0; i < artistArray.length; i++) {
                    db.reviewDB.set(artistArray[i], ep_review, `["${ep_name}"].["${interaction.user.id}"].review`);
                }
            }

            msg.edit({ embeds: [msgEmbed] });
        });

        interaction.editReply(`Updated your review of ${ep_name} to house the new data. Check your review in #reviews!`);
    },
};