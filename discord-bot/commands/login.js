/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup } = require('../func.js');
const lastfm = require('lastfm-njs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Connect your Spotify or Last.fm account to Waveform.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
			subcommand.setName('spotify')
				.setDescription('Login with Spotify.'))
        .addSubcommand(subcommand =>
            subcommand.setName('lastfm')
                .setDescription('Login with Last.fm')
                .addStringOption(option => 
                    option.setName('username')
                        .setDescription('Your Last.fm username (case sensitive!)')
                        .setRequired(true))),
    help_desc: `Connect your Spotify or Last.fm account to Waveform, unlocking the main features of the bot such as using your spotify playback in place of arguments, Waveform Mailbox functionality, and more.\n\n` +
    `In order for the Spotify version of this command to work, Waveform must be able to DM you, so please ensure you allow it to do so!\n\n` + 
    `This command only needs to be run one time for you to stay logged in, unless your password gets changed or you make a new Spotify account, or for Last.fm, if you change your username.`,
	async execute(interaction) {
        let loginType = interaction.options.getSubcommand();
        
        if (loginType == 'spotify') {
            await interaction.reply({ content: 'Sent a DM about logging in to Waveform with Spotify!' });
            let dmMsg = await interaction.user.send('Here is how you login to Waveform with Spotify!\nGo to [this website](https://nimble-kataifi-dbceca.netlify.app/), then with the refresh token it returns, send the refresh token here (as a message), and you\'ll be all set!' +
            `\nPlease note that this process works best on Chrome. Your mileage may vary on other platforms, but if you are not receiving a proper refresh token, try using chrome, and try disabling any password collectors you may have. If you are still running into issues, please contact jeffdev on Discord!`);
            let msg_filter = m => m.author.id == interaction.user.id && m.content.length > 30;
            const collector = await dmMsg.channel.createMessageCollector({ filter: msg_filter, max: 1, time: 240000 });

            collector.on('collect', async token => {
                await db.user_stats.set(interaction.user.id, token.content, 'refresh_token');
                await db.user_stats.set(interaction.user.id, 'na', 'access_token');
                await spotify_api_setup(interaction.user.id, true);

                interaction.user.send('✅ Authentication successful! You can now use the Spotify API with Waveform.\nTry out using `/setupmailbox` to setup a waveform spotify mailbox, and check out the usage guides for how to use commands!\n\n' +
                `**For security reasons and because I am unable to delete your message, please delete the message with your token, and don't share this refresh token with ANYONE!**\n` +
                `**If you are concerned about the security of this command, please reach out to the bot developer Jeffdev or review the GitHub page to see how your token is used within Waveform.**`);
                dmMsg.edit('Authorization completed!');
                interaction.editReply('Login was successful!');
            });
            
            collector.on('end', (collected) => {
                if (collected.size == 0) {
                    dmMsg.edit('Passed maximum time to enter the token. Run `/login` again and you\'ll get another chance!');
                    interaction.editReply('Login was unsuccessful due to timeout. Please run `/login` again.');
                }
            });
        } else {
            let lfmUsername = interaction.options.getString('username');

            let lfm = new lastfm.default({
                apiKey: process.env.LAST_FM_API_KEY,
                apiSecret: process.env.LAST_FM_API_SECRET,
                username: lfmUsername,
            });

            let lfmUserData = await lfm.user_getInfo({ user: lfmUsername });
            if (lfmUserData.success != false) {
                db.user_stats.set(interaction.user.id, lfmUsername, 'lfm_username');
                interaction.reply(`Connected the Last.fm account \`${lfmUsername}\` to Waveform!`);
            } else {
                interaction.reply(`The user \`${lfmUsername}\` was not found on Last.fm. Please try again.`);
            }

            
        }

    },
};
