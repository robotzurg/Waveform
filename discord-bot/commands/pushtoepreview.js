const { handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pushtoepreview')
        .setDescription('Push an existing review to an EP/LP review.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Push a review to an EP/LP review by utilizing your currently playing spotify song (requires login).'))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Push a review to an EP/LP review by manually entering information.')

            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s). (DO NOT PUT ANY REMIXERS HERE)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song. (Do not include any features or remixers in here!)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Put remixers here, if you reviewing a remix of the original song. (NOT IN ARTISTS ARGUMENT)')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `Push an existing song review you've made in the database into an ongoing EP/LP review. See the "EP/LP Review Guide" button to find out how this works.\n\n`
    + `The subcommand \`with_spotify\` pulls from your spotify playback (if logged into Waveform with Spotify)` + 
    ` while the \`manually\` subcommand allows you to manually type in the song name yourself.`,
	async execute(interaction, client) {
        try {
            // This command basically just runs /review, but instead of pulling from arguments for the review, it pulls from the database.
            // The reason its in a separate command is because that comes across better in usage of the bot, rather than
            // making it an optional argument for /review.
            let command = client.commands.get('review');
            command.execute(interaction, client);
        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};
