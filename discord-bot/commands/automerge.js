const db = require('../db.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('automerge')
		.setDescription('Set if you would like to or not like to have reviews auto-merge to EP/LP reviews.')
        .addBooleanOption(option => 
            option.setName('value')
                .setDescription('Whether you would like to have reviews auto-merge to EP/LP reviews or not (T/F)')
                .setRequired(true)),
    admin: true,
	execute(interaction) {
        const auto_merge = interaction.options.getBoolean('value');
        db.user_stats.set(interaction.user.id, auto_merge, 'auto_merge_to_ep');
        interaction.editReply({ content: `Changed your EP/LP review auto-merge setting to \`${auto_merge}\`.` + 
        `\n**WARNING: TURNING THIS SETTING ON MEANS YOU WILL NOT BE ABLE TO EDIT REVIEWS BEFORE THEY GET PUT ON THE EP/LP REVIEW.**` + 
        `\nYou can still edit reviews/ratings, but please make sure your artist name/vocalist name and song name are correct!` });
	},
};