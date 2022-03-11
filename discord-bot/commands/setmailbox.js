const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmailbox')
        .setDescription('Set a users mailbox in Waveform.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose mailbox you\'d like to set.')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('Which channel the mailbox is.')
                .setRequired(true)),
	admin: true,
	async execute(interaction) {
        try {

        const usr = interaction.options.getUser('user');
        const mailbox_channel = interaction.options.getChannel('channel');

        db.user_stats.set(usr.id, mailbox_channel.id, 'mailbox');
        db.server_settings.push(interaction.guild.id, mailbox_channel.name, 'mailboxes');

        interaction.editReply(`User ID: ${usr.id}'s Mailbox set to ${mailbox_channel}.`);

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};