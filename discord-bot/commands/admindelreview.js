const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('admindelreview')
		.setDescription('Delete any users review. Only available to bot admins.')
        .setDMPermission(false)
        .addStringOption(option => (
            option.setName('user_id')
                .setDescription('The user id of the user to delete the review of')
                .setRequired(true)
        ))

        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song/EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, for remix reviews.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `Admin command. Deletes any users review.`,
    async execute(interaction, client) {
        if (interaction.user.id != '122568101995872256') return interaction.reply('This command is not for you.');
        let userID = interaction.options.getString('user_id');
        let command = client.commands.get('deletereview');
        command.execute(interaction, client, userID);
	},
};