const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Display your (or others) user profile!')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose profile you\'d like to see.')
                .setRequired(false)),
	admin: true,
	async execute(interaction) {
        let channel = interaction.guild.channels.cache.get('9207586446210581');
        try {
            channel.send('Test');
        } catch (err) {
            interaction.editReply(`Waveform ran into an error.\n<@122568101995872256> has been notified and will fix this as soon as possible!`);
            let error_channel = interaction.guild.channels.cache.get('920758644621058139');
            interaction.fetchReply().then(msg => {
                error_channel.send(`Waveform Error!\nMessage Link with Error: <${msg.url}>`);
            });
            console.log(err);
        }
    },
};