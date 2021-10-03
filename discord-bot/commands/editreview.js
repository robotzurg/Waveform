const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editreview')
        .setDescription('Edit a song review.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The user whose mailbox you\'d like to set.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('song')
                .setDescription('The user whose mailbox you\'d like to set.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('rating')
                .setDescription('The new rating of the review')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('review')
                .setDescription('The new rating of the review')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('user_who_sent')
                .setDescription('The new user who sent you the song for the review')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, use this to delete remix reviews.')
                .setRequired(false)),
	admin: true,
	async execute(interaction) {
        return interaction.editReply('Not available yet');
        let artistArray = interaction.options.getString('artists');
        let songName = interaction.options.getString('song');
        //let rating = interaction.options.getString('rating');
       //let review = interaction.options.getString('review');
        //let user_who_sent = interaction.options.getString('user_who_sent');
        //let remixers = interaction.options.getString('remixers');


        let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].msg_id`);

        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
        channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
            msg.delete();
        }).catch(() => {
            channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
            channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                msg.delete();
            });
        });

        interaction.editReply(`Edited your ${artistArray.join(' & ')} - ${songName} review.`);
    },
};