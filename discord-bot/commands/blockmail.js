const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blockmail')
        .setDescription('Block or unblock a user from sending you music.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who you would like to block/unblock.')
                .setRequired(true)),
    help_desc: `Blocks or unblocks a user from being sent music to your Waveform mailbox. If the user is blocked, it'll unblock, and vice versa.`,
	async execute(interaction) {
        let taggedUser = interaction.options.getUser('user');
        let taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        let currentBlocklist = db.user_stats.get(interaction.user.id, 'mailbox_blocklist');
        if (currentBlocklist == undefined) currentBlocklist = [];
        if (taggedUser.id == interaction.user.id) return interaction.reply({ content: 'You can\'t block yourself!', ephemeral: true });

        if (currentBlocklist.includes(taggedUser.id)) {
            // Unblock
            currentBlocklist = currentBlocklist.filter(v => v !== taggedUser.id);
            interaction.reply({ content: `Successfully unblocked the user **${taggedMember.displayName}** from sending you mail.`, ephemeral: true });
        } else {
            // Block
            currentBlocklist.push(taggedUser.id);
            interaction.reply({ content: `Successfully blocked the user **${taggedMember.displayName}** from sending you mail.`, ephemeral: true });
        }
        db.user_stats.set(interaction.user.id, currentBlocklist, 'mailbox_blocklist');
    },
};
