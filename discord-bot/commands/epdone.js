const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { handle_error, get_review_channel } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdone')
        .setDescription('Finish an in-progress EP/LP review.')
        .setDMPermission(false),
	help_desc: `Manually finishes an in-progress EP/LP review. For use in non-spotify EP/LP reviews when you have reviewed each song, or any other times you may run into an issue with the normal button.`,
	async execute(interaction, client) {
        try {
            let epReviewUserData = db.user_stats.get(interaction.user.id, 'current_ep_review');
            let channelsearch = await get_review_channel(client, epReviewUserData.guild_id, epReviewUserData.channel_id, epReviewUserData.msg_id);
            
            if (channelsearch != undefined) {
                await channelsearch.messages.fetch(`${epReviewUserData.msg_id}`).then(msg => {
                    if (msg.components[0] != undefined) {
                        if (msg.components[0].components[0] != undefined) {
                            if (msg.components[0].components[0].data.custom_id == 'artist') {
                                msg.delete();
                                return;
                            }
                        }
                    }

                    msg.edit({ components: [] });
                }).catch(() => {});
            }

            db.user_stats.set(interaction.user.id, false, 'current_ep_review');
            await interaction.reply({ content: `Successfully ended your EP/LP review manually.`, ephemeral: true });
        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};