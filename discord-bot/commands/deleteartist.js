const db = require("../db.js");
const { capitalize } = require("../func.js");

module.exports = {
	name: 'deleteartist',
    description: 'Deletes an artist from the database.',
	options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        },
    ],
    admin: true,
	execute(interaction) {
		interaction.options[0].value = capitalize(interaction.options[0].value);
		db.reviewDB.delete(interaction.options[0].value);
		interaction.editReply(`${interaction.options[0].value} deleted from the database.`);
	},
};