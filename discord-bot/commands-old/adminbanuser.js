const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('adminbanuser')
		.setDescription('Ban or unban a user from using the bot')
        .setDMPermission(false)
        .addStringOption(option => (
            option.setName('user_id')
                .setDescription('The user id of the user to ban.')
                .setRequired(true)
        ))
        .addBooleanOption(option => (
            option.setName('unban')
                .setDescription('Set to true if you\'d like to unban instead of ban.')
                .setRequired(false)
        )),
    help_desc: `Admin command. Bans or unbans a user from the bot.`,
    async execute(interaction) {
        if (interaction.user.id != '122568101995872256') return interaction.reply('This command is not for you.');
        let userID = interaction.options.getString('user_id');
        let unban = interaction.options.getBoolean('unban');
        if (unban == null) unban = false;

        if (unban == false) {
            db.global_bot.push('ban_list', userID);
        } else {
            let banList = db.global_bot.get('ban_list');
            banList = banList.filter(v => v !== userID);
            db.global_bot.set('ban_list', banList);
        }

        interaction.reply(`${unban == true ? `Unbanned` : `Banned`} the user <@${userID}> from reviewing in the database.`);
	},
};