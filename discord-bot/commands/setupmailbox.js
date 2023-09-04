const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { handle_error, spotify_api_setup } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupmailbox')
        .setDescription('Setup a Waveform Mailbox.')
        .setDMPermission(false),
    help_desc: `Sets up a Waveform Mailbox system. This creates a mailbox playlist on Spotify if the user is logged into spotify, and sets up internal variables to be able to hold the data.\n\n` + 
    `Waveform Mailboxes cannot be used without running this command first, and the spotify playlist can safely be set as private or deleted without interfering with the system.\n\n` + 
    `You can use a Waveform Mailbox if you are not connected to Spotify, but you will lose lots of functionality.`,
	async execute(interaction, client) {
        try {

        // Setup spotify web api stuff
        const spotifyApi = await spotify_api_setup(interaction.user.id);
        let spotifyCheck = true;
        if (spotifyApi == false) spotifyCheck = false;
        await interaction.reply('Setting up mailbox...');

        if (spotifyCheck != false) { 
            await spotifyApi.createPlaylist('Waveform Mailbox', { 'description': 'Your own personal Waveform Mailbox for people to send you music! Will be updated with music that people send you!', 'public': true })
            .then(async function(data) {
                db.user_stats.set(interaction.user.id, data.body.id, 'mailbox_playlist_id');
                db.user_stats.set(interaction.user.id, [], 'mailbox_list');
                db.user_stats.set(interaction.user.id, [], 'mailbox_history');
                db.user_stats.set(interaction.user.id, true, 'spotify_mailbox'); 
                db.user_stats.set(interaction.user.id, true, 'config.mailbox_dm');
                await interaction.editReply(`Your mailbox has now been setup on Spotify, and \`/sendmail\` can now be used with it!\n` + 
                `If you need to delete the playlist for whatever reason, make sure you run this command again to setup a new one!\n\n` + 
                `To send mail to users with a mailbox, use \`/sendmail!\` You can find more details on mailboxes as a whole in the Waveform Mailbox help guide.\n\n` + 
                `**NOTE: DO NOT DELETE THIS PLAYLIST, OR ELSE YOUR MAILBOX WILL NOT WORK PROPERLY!**`);
            }, async function(err) {
                await interaction.editReply(`Something went wrong with your mailbox creation, you should probably let Jeff know!`);
                console.log('Something went wrong!', err);
            });
        } else {
            db.user_stats.set(interaction.user.id, false, 'mailbox_playlist_id');
            db.user_stats.set(interaction.user.id, [], 'mailbox_list');
            db.user_stats.set(interaction.user.id, [], 'mailbox_history');
            db.user_stats.set(interaction.user.id, false, 'spotify_mailbox'); 
            db.user_stats.set(interaction.user.id, true, 'config.mailbox_dm');
            await interaction.editReply(`Your mailbox has now been setup on Waveform. Because this is not a spotify linked mailbox, it cannot be sent Spotify Links, but users can send you mail manually in your channel!\n`
             + `If you meant to create a Spotify mailbox, please make sure you run \`/login\`, then run this command again, and you will have a Spotify Mailbox properly created!`);
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};