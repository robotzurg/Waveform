const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func');
/*const { Modal, TextInputComponent, showModal } = require('discord-modals'); // Now we extract the showModal method

const modal = new Modal() // We create a Modal
.setCustomId('modal-customid')
.setTitle('Write a Waveform Review')
.addComponents(
  new TextInputComponent() // We create a Text Input Component
  .setCustomId('textinput-customid')
  .setLabel('Artist Names')
  .setStyle('SHORT') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
  .setMinLength(1)
  .setMaxLength(100)
  .setPlaceholder('Write the names of the artists involved here')
  .setRequired(true), // If it's required or not
  new TextInputComponent() // We create a Text Input Component
  .setCustomId('textinput-customid_1')
  .setLabel('Song Name')
  .setStyle('SHORT') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
  .setMinLength(1)
  .setMaxLength(100)
  .setPlaceholder('Write the song name here')
  .setRequired(true), // If it's required or not
  new TextInputComponent() // We create a Text Input Component
  .setCustomId('textinput-customid_2')
  .setLabel('Rating')
  .setStyle('SHORT') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
  .setMinLength(1)
  .setMaxLength(4)
  .setPlaceholder('Write your rating out of 10')
  .setRequired(true), // If it's required or not
  new TextInputComponent() // We create a Text Input Component
  .setCustomId('textinput-customid_3')
  .setLabel('Review')
  .setStyle('LONG') //IMPORTANT: Text Input Component Style can be 'SHORT' or 'LONG'
  .setMinLength(1)
  .setMaxLength(4000)
  .setPlaceholder('Write your review for the song here')
  .setRequired(true), // If it's required or not
);*/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)'),
	async execute(interaction) {
        try {
            interaction.editReply('Test');
        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
    },
};