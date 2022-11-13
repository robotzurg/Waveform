const db = require("../db.js");
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { handle_error, spotify_api_setup } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupmailbox')
        .setDescription('Setup a mailbox in Waveform through Spotify itself!')
        .addStringOption(option => 
            option.setName('playlist_name')
                .setDescription('The name of the mailbox playlist on Spotify (defaults to Waveform Mailbox)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('playlist_desc')
                .setDescription('The description for your mailbox playlist on Spotify.')
                .setRequired(false)),
	async execute(interaction) {
        try {

        // Setup spotify web api stuff
        const spotifyApi = await spotify_api_setup(interaction.user.id);
        let spotifyCheck = true;
        if (spotifyApi == false) spotifyCheck = false;
        await interaction.reply('Setting up mailbox...');

        let playlist_name = interaction.options.getString('playlist_name');
        if (playlist_name == null) playlist_name = 'Waveform Mailbox';
        let playlist_desc = interaction.options.getString('playlist_desc');
        if (playlist_desc == null) playlist_desc = 'Your own personal Waveform Mailbox for people to send you music! Will be updated with music that people send you!';

        let category = await interaction.guild.channels.cache.find((c) => c.name.toLowerCase() === "mailboxes" && c.type === ChannelType.GuildCategory);
        if (!category) {
            category = await interaction.guild.channels.create({
                name: 'Mailboxes',
                type: ChannelType.GuildCategory,
            });
        }

        let channel = await interaction.guild.channels.cache.find((c) => c.name === interaction.user.username.replace(' ', '-').toLowerCase());
        if (channel == undefined) {
            channel = await interaction.guild.channels.create({
            name: interaction.user.username.replace(' ', '-').toLowerCase(),
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { 
                    id: interaction.user.id, 
                    allow: ['MANAGE_MESSAGES'],
                },
            ],
          });
          channel.setParent(category, { lockPermissions: false });
        }

        if (spotifyCheck != false) { 
            await spotifyApi.createPlaylist(playlist_name, { 'description': playlist_desc, 'public': true })
            .then(async function(data) {
                db.user_stats.set(interaction.user.id, data.body.id, 'mailbox_playlist_id');
                db.user_stats.set(interaction.user.id, channel.id, 'mailbox');
                db.server_settings.push(interaction.guild.id, [interaction.user.id, channel.id], 'mailboxes');
                await interaction.editReply(`Your mailbox has now been setup on Spotify, and \`/sendmail\` can now be used with it!\n` + 
                `If you need to delete the playlist for whatever reason, make sure you run this command again to setup a new one!\n\n` + 
                `You should also have a new channel created under your name in the "Mailboxes" category, this is where all of your mailbox happenings will be in!\n` + 
                `You can use this chat to review your mailbox tracks, and it will also have messages sent in it any time you receive new mail.\n\n` +
                `**NOTE: DO NOT DELETE THIS PLAYLIST OR THE MAILBOX TEXT CHANNEL, OR ELSE YOUR MAILBOX WILL NOT WORK PROPERLY!**`);
            }, async function(err) {
                await interaction.editReply(`Something went wrong with your mailbox creation, you should probably let Jeff know!`);
                console.log('Something went wrong!', err);
            });
        } else {
            db.user_stats.set(interaction.user.id, false, 'mailbox_playlist_id');
            db.user_stats.set(interaction.user.id, channel.id, 'mailbox');
            db.server_settings.push(interaction.guild.id, [interaction.user.id, channel.id], 'mailboxes');
            await interaction.editReply(`Your mailbox has now been setup on Waveform. Because this is not a spotify linked mailbox, it cannot be sent Spotify Links, but users can send you mail manually in your channel!`);
        }

        

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};