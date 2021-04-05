const Discord = require('discord.js');

module.exports = {
    test: function() {
        console.log('Test');
    },

    // The main reason this function exists is to provide a easier in-code solution for error handling Unknown Message errors.
    msg_delete_timeout: function(msg, dur, content = false) {
        if (content === false) {
            msg.delete({ timeout: dur }).catch(error => {
                if (error.code !== Discord.Constants.APIErrors.UNKNOWN_MESSAGE) {
                    console.error('Failed to delete the message:', error);
                }
            });
        } else {
            msg.channel.send(content).then(m => {
                m.delete({ timeout: dur }).catch(error => {
                    if (error.code !== Discord.Constants.APIErrors.UNKNOWN_MESSAGE) {
                        console.error('Failed to delete the message:', error);
                    }
                });
            });
        }
    },

    filter_users: function(array) {
        array = array.filter(e => e !== 'Remixers');
        array = array.filter(e => e !== 'EP');
        array = array.filter(e => e !== 'Collab');
        array = array.filter(e => e !== 'Image');
        array = array.filter(e => e !== 'Vocals');
        array = array.filter(e => e !== 'Songs');
        array = array.filter(e => e !== 'EPpos');

        return array;
    },

    arrayRemove: function(arr, value) { 
    
        return arr.filter(function(ele) { 
            return ele != value; 
        });
    },
};