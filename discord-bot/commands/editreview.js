const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editreview')
        .setDescription('Edit a song review.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The artists of the song you would like to edit the review of (No Remixers Here).')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('song')
                .setDescription('The song you would like to edit the review of.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('rating')
                .setDescription('The new rating of the review.')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('review')
                .setDescription('The new written review.')
                .setRequired(false))
        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('The new user who sent you the song for the review')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remixers that remixed the song you are editing the review of.')
                .setRequired(false)),
	admin: true,
	async execute(interaction) {
        let artistArray = interaction.options.getString('artists');
        let songName = interaction.options.getString('song');
        let rating = interaction.options.getString('rating');
        let review = interaction.options.getString('review');
        let user_who_sent = interaction.options.getUser('user_who_sent');
        let rmxArray = interaction.options.getString('remixers');
        let taggedMember;
        let taggedUser;
        let oldrating;
        let oldreview;

        if (user_who_sent != null && user_who_sent != undefined) {
            taggedMember = await interaction.guild.members.fetch(user_who_sent);
            taggedUser = taggedMember.user;
        }

        artistArray = artistArray.split(' & ');
        if (!db.reviewDB.has(artistArray[0])) return interaction.editReply(`Artist ${artistArray[0]} not found!`);

        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                artistArray = artistArray.flat(1);
            }
        }

        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                artistArray.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                artistArray = artistArray.flat(1);
            }
        }

        if (rmxArray != null && rmxArray != undefined) {
            rmxArray = rmxArray.split(' & ');
            artistArray = rmxArray;
            songName = `${songName} (${rmxArray.join(' & ')} Remix)`;
        }

        for (let i = 0; i < artistArray.length; i++) {
            if (!db.reviewDB.has(artistArray[i])) return interaction.editReply(`Artist ${artistArray[i]} not found!`);
            if (!db.reviewDB.get(artistArray[i], songName) === undefined) return interaction.editReply(`Song ${songName} not found!`);
            if (!db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"]`) === undefined) return interaction.editReply(`Review not found!`);

            if (rating != null && rating != undefined) {
                oldrating = db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].rating`);
                db.reviewDB.set(artistArray[i], parseFloat(rating), `["${songName}"].["${interaction.user.id}"].rating`);
            } 

            if (review != null && review != undefined) {
                oldreview = db.reviewDB.get(artistArray[i], `["${songName}"].["${interaction.user.id}"].review`);
                db.reviewDB.set(artistArray[i], review, `["${songName}"].["${interaction.user.id}"].review`);
            }

            if (user_who_sent != null && user_who_sent != undefined) db.reviewDB.set(artistArray[i], user_who_sent.id, `["${songName}"].["${interaction.user.id}"].user_who_sent`);
        }

        let reviewMsgID = db.reviewDB.get(artistArray[0], `["${songName}"].["${interaction.user.id}"].msg_id`);

        if (reviewMsgID != false) {
            let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
            channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                let embed_data = msg.embeds;
                let msgEmbed = embed_data[0];

                if (rating != null && rating != undefined) msgEmbed.fields[0].value = `**${rating}/10**`;
                if (review != null && review != undefined) msgEmbed.setDescription(review);
                if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);

                msg.edit({ embeds: [msgEmbed] });
            }).catch(() => {
                channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                channelsearch.messages.fetch(`${reviewMsgID}`).then(msg => {
                    let embed_data = msg.embeds;
                    let msgEmbed = embed_data[0];
    
                    if (rating != null && rating != undefined) msgEmbed.fields[0].value = `**${rating}/10**`;
                    if (review != null && review != undefined) msgEmbed.setDescription(review);
                    if (user_who_sent != null && user_who_sent != undefined) msgEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
    
                    msg.edit({ embeds: [msgEmbed] });
                });
            });
        }

        let ep_from = db.reviewDB.get(artistArray[0], `["${songName}"].ep`);
        if (ep_from != false && ep_from != undefined) {
            if (db.reviewDB.get(artistArray[0], `["${ep_from}"].["${interaction.user.id}"]`) != undefined) {
                let epMsgToEdit = db.reviewDB.get(artistArray[0], `["${ep_from}"].["${interaction.user.id}"].msg_id`);

                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                channelsearch.messages.fetch(`${epMsgToEdit}`).then(msg => {
                    let msgEmbed = msg.embeds[0];
                    let msg_embed_fields = msgEmbed.fields;
                    let field_num = -1;
                    for (let i = 0; i < msg_embed_fields.length; i++) {
                        if (msg_embed_fields[i].name.includes(songName)) {
                            field_num = i;
                        }
                    }

                    if (rating != null && rating != undefined) {
                        if (msg_embed_fields[field_num].name.includes('🌟')) {
                            msg_embed_fields[field_num].name = `🌟 ${songName} (${rating}/10) 🌟`;
                        } else {
                            msg_embed_fields[field_num].name = `${songName} (${rating}/10)`;
                        }
                    } 
                    if (review != null && review != undefined) msg_embed_fields[field_num].value = review;

                    msg.edit({ embeds: [msgEmbed] });
                });
            } 
        }

        interaction.editReply(`Here's what was edited on your review of **${artistArray.join(' & ')} - ${songName}**:` +
        `\n${(oldrating != undefined) ? `\`${oldrating}/10\` changed to \`${rating}/10\`` : ``}` +
        `\n${(oldreview != undefined) ? `Review was changed to \`${review}\`` : ``}`);
    },
};