const { prefix } = require('../config.json');
const Discord = require('discord.js');

module.exports = {
    name: 'help',
    type: 'Support',
	description: 'List all of my commands or info about a specific command.',
    arg_num: 1,
	usage: '[command name]',
	execute(message, args) {
        const data = [];
        const support = [];
        const admin = [];
        const reviewdb = [];
        const fun = [];
        const { commands } = message.client;

        if (!args.length) {
            data.push(commands.map(command => command.name));

            for (let i = 0; i < data[0].length; i++) {
                const cmdtype = commands.get(data[0][i]).type;

                switch (cmdtype) {
                    case "Bot": break;
                    case 'Support': support.push(data[0][i]); break;
                    case 'Review DB': reviewdb.push(data[0][i]); break;
                    case "Admin": admin.push(data[0][i]); break;
                    case 'Fun': fun.push(data[0][i]); break;
                }
            }

            const exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`Hotdog Water Bot Commmands`)
            .setFooter('You can send !help <command_name> to get info on a specific command.')
            .addField('Support Commands:', support)
            .addField('Review DB Commands:', reviewdb)
            .addField('Fun Commands:', fun)
            .addField('Admin Commands:', admin);

            return message.author.send(exampleEmbed)
                .then(() => {
                    if (message.channel.type === 'dm') return;
                    message.reply('I\'ve sent you a DM with all my commands!');
                })
                .catch(error => {
                    console.error(`Could not send help DM to ${message.author.tag}.\n`, error);
                    message.reply('it seems like I can\'t DM you! Do you have DMs disabled?');
                });
        }

        const name = args[0].toLowerCase();
        const command = commands.get(name);

        if (!command) {
            return message.reply('that\'s not a valid command!');
        }

        data.push(`**Name:** ${command.name}`);

        if (command.description) data.push(`**Description:** ${command.description}`);
        if (command.usage) data.push(`**Usage:** \`${prefix}${command.name} ${command.usage}\``);

        const specCommandEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${prefix}${command.name}`);
            specCommandEmbed.setDescription(`${command.description}`)
            .addField('Aliases:', `\`${command.aliases.join(', ')}\``)
            .addField('Example Usage:', `\`${prefix}${command.name} ${command.usage}\``);
            if (command.type === 'Review DB') {
                specCommandEmbed.addField(`For more info:`, command.moreinfo);
            }
            

        message.channel.send(specCommandEmbed);

	},
};